import { vi, describe, beforeEach, test, expect } from 'vitest'

const mockSqsClient = {
  send: vi.fn()
}

const mockProcessEvent = vi.fn()

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => mockSqsClient),
  ReceiveMessageCommand: vi.fn((params) => ({ params })),
  DeleteMessageCommand: vi.fn((params) => ({ params }))
}))

vi.mock('../../../src/events/process.js', () => ({
  processEvent: mockProcessEvent
}))

vi.mock('../../../src/config.js', () => ({
  config: {
    get: (key) => {
      if (key === 'aws') {
        return {
          sqs: {
            queueUrl: 'http://localhost:4566/000000000000/test-queue'
          },
          region: 'eu-west-2',
          endpoint: 'http://localhost:4566',
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      }
      return null
    }
  }
}))

const mockLogError = vi.fn()

vi.mock('../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({
    error: mockLogError
  })
}))

const { consumeEvents } = await import('../../../src/events/consumer.js')

describe('consumeEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should check for new events as SQS messages', async () => {
    mockSqsClient.send.mockResolvedValueOnce({ Messages: [] })

    await consumeEvents()

    expect(mockSqsClient.send).toHaveBeenCalledTimes(1)
    expect(mockSqsClient.send).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({
        QueueUrl: 'http://localhost:4566/000000000000/test-queue',
        MaxNumberOfMessages: 10,
        MessageAttributeNames: ['All'],
        AttributeNames: ['SentTimestamp'],
        WaitTimeSeconds: 10,
      })
    }))
  })

  test('should not process events if no event messages are received', async () => {
    mockSqsClient.send.mockResolvedValueOnce({ Messages: null })

    await consumeEvents()

    expect(mockProcessEvent).not.toHaveBeenCalled()
    expect(mockSqsClient.send).toHaveBeenCalledTimes(1)
  })

  test('should process single event if one message received', async () => {
    const testMessages = [
      { ReceiptHandle: 'receipt-1', Body: 'message-1' }
    ]

    mockSqsClient.send
      .mockResolvedValueOnce({ Messages: testMessages }) // ReceiveMessageCommand
      .mockResolvedValueOnce({}) // DeleteMessageCommand for message 1

    await consumeEvents()

    expect(mockSqsClient.send).toHaveBeenCalledTimes(2)
    expect(mockProcessEvent).toHaveBeenCalledTimes(1)
    expect(mockProcessEvent).toHaveBeenCalledWith(testMessages[0])
  })

  test('should delete message from SQS after successful processing', async () => {
    const testMessage = { ReceiptHandle: 'receipt-1', Body: 'message-1' }

    mockSqsClient.send
      .mockResolvedValueOnce({ Messages: [testMessage] }) // ReceiveMessageCommand
      .mockResolvedValueOnce({}) // DeleteMessageCommand

    await consumeEvents()
    expect(mockSqsClient.send).toHaveBeenCalledTimes(2)
    expect(mockSqsClient.send).toHaveBeenNthCalledWith(2, expect.objectContaining({
      params: {
        QueueUrl: 'http://localhost:4566/000000000000/test-queue',
        ReceiptHandle: 'receipt-1'
      }
    }))
  })

  test('should process multiple events if multiple messages received', async () => {
    const testMessages = [
      { ReceiptHandle: 'receipt-1', Body: 'message-1' },
      { ReceiptHandle: 'receipt-2', Body: 'message-2' }
    ]

    mockSqsClient.send
      .mockResolvedValueOnce({ Messages: testMessages }) // ReceiveMessageCommand
      .mockResolvedValueOnce({}) // DeleteMessageCommand for message 1
      .mockResolvedValueOnce({}) // DeleteMessageCommand for message 2

    await consumeEvents()

    expect(mockSqsClient.send).toHaveBeenCalledTimes(3)
    expect(mockProcessEvent).toHaveBeenCalledTimes(2)
    expect(mockProcessEvent).toHaveBeenCalledWith(testMessages[0])
    expect(mockProcessEvent).toHaveBeenCalledWith(testMessages[1])
  })

  test('should delete multiple messages from SQS after successful processing', async () => {
    const testMessages = [
      { ReceiptHandle: 'receipt-1', Body: 'message-1' },
      { ReceiptHandle: 'receipt-2', Body: 'message-2' }
    ]

    mockSqsClient.send
      .mockResolvedValueOnce({ Messages: testMessages }) // ReceiveMessageCommand
      .mockResolvedValueOnce({}) // DeleteMessageCommand for message 1
      .mockResolvedValueOnce({}) // DeleteMessageCommand for message 2

    await consumeEvents()

    expect(mockSqsClient.send).toHaveBeenCalledTimes(3)
    expect(mockSqsClient.send).toHaveBeenNthCalledWith(2, expect.objectContaining({
      params: {
        QueueUrl: 'http://localhost:4566/000000000000/test-queue',
        ReceiptHandle: 'receipt-1'
      }
    }))
    expect(mockSqsClient.send).toHaveBeenNthCalledWith(3, expect.objectContaining({
      params: {
        QueueUrl: 'http://localhost:4566/000000000000/test-queue',
        ReceiptHandle: 'receipt-2'
      }
    }))
  })

  test('should log error and continue processing other events when processing fails', async () => {
    const testMessages = [
      { ReceiptHandle: 'receipt-1', Body: 'message-1' },
      { ReceiptHandle: 'receipt-2', Body: 'message-2' }
    ]
    const processError = new Error('Processing failed')

    mockSqsClient.send.mockResolvedValueOnce({ Messages: testMessages })
    mockProcessEvent
      .mockRejectedValueOnce(processError) // First message fails
      .mockResolvedValueOnce() // Second message succeeds

    await consumeEvents()

    expect(mockProcessEvent).toHaveBeenCalledTimes(2)
    expect(mockLogError).toHaveBeenCalledWith(processError, 'Unable to process event')
    expect(mockSqsClient.send).toHaveBeenCalledTimes(2) // Only delete successful message
  })

  test('should not delete message when processing fails', async () => {
    const testMessage = { ReceiptHandle: 'receipt-1', Body: 'message-1' }
    const processError = new Error('Processing failed')

    mockSqsClient.send.mockResolvedValueOnce({ Messages: [testMessage] })
    mockProcessEvent.mockRejectedValueOnce(processError)

    await consumeEvents()

    expect(mockSqsClient.send).toHaveBeenCalledTimes(1) // Only ReceiveMessage, no DeleteMessage
    expect(mockLogError).toHaveBeenCalledWith(processError, 'Unable to process event')
  })
})
