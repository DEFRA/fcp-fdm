import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockSend = vi.fn()
const mockLogInfo = vi.fn()
const mockLogError = vi.fn()
const mockConfig = { 'aws.sqs.queueUrl': 'http://localhost:4566/000000000000/test-queue' }

vi.mock('@aws-sdk/client-sqs', () => ({
  GetQueueAttributesCommand: vi.fn(function (params) { return { params } })
}))

vi.mock('../../../../../src/events/sqs-client.js', () => ({
  sqsClient: { send: mockSend }
}))

vi.mock('../../../../../src/config/config.js', () => ({
  config: { get: (key) => mockConfig[key] }
}))

vi.mock('../../../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ info: mockLogInfo, error: mockLogError })
}))

const { healthCheck } = await import('../../../../../src/common/helpers/health/sqs.js')

describe('sqs health check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig['aws.sqs.queueUrl'] = 'http://localhost:4566/000000000000/test-queue'
    mockSend.mockResolvedValue({ Attributes: { QueueArn: 'arn' } })
  })

  test('should read the queue attributes and log success', async () => {
    // act
    await healthCheck()

    // assert
    expect(mockSend).toHaveBeenCalledWith({
      params: {
        QueueUrl: 'http://localhost:4566/000000000000/test-queue',
        AttributeNames: ['QueueArn']
      }
    })
    expect(mockLogInfo).toHaveBeenCalledWith('SUCCESS: Connected to SQS queue')
  })

  test('should log and rethrow when the queue cannot be reached', async () => {
    // arrange
    const error = new Error('AWS.SimpleQueueService.NonExistentQueue')
    mockSend.mockRejectedValueOnce(error)

    // act / assert
    await expect(healthCheck()).rejects.toThrow('AWS.SimpleQueueService.NonExistentQueue')
    expect(mockLogError).toHaveBeenCalledWith(error, 'Error connecting to SQS queue')
  })

  test('should fail without calling sqs when the queue url is not set', async () => {
    // arrange
    mockConfig['aws.sqs.queueUrl'] = null

    // act / assert
    await expect(healthCheck()).rejects.toThrow('AWS_SQS_QUEUE_URL is not set')
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), 'Error connecting to SQS queue')
  })
})
