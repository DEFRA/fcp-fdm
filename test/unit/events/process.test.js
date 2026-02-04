import { vi, describe, beforeEach, test, expect } from 'vitest'

const mockLoggerInfo = vi.fn()

vi.mock('../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ info: (...args) => mockLoggerInfo(...args) })
}))

const mockParseEvent = vi.fn()

vi.mock('../../../src/events/parse.js', () => ({
  parseEvent: mockParseEvent
}))

const mockGetEventType = vi.fn()

vi.mock('../../../src/events/types.js', () => ({
  getEventType: mockGetEventType
}))

const mockValidateEvent = vi.fn()

vi.mock('../../../src/events/validate.js', () => ({
  validateEvent: mockValidateEvent
}))

const mockSaveEvent = vi.fn()

vi.mock('../../../src/events/save.js', () => ({
  saveEvent: mockSaveEvent
}))

const { processEvent } = await import('../../../src/events/process.js')

const testEvent = {
  id: '12345',
  type: 'uk.gov.defra.fcp.event'
}

const testRawEvent = {
  Body: JSON.stringify({
    Message: JSON.stringify(testEvent)
  })
}

describe('processEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParseEvent.mockReturnValue(testEvent)
    mockGetEventType.mockReturnValue('test-event-type')
  })

  test('should parse raw event into JSON', async () => {
    await processEvent(testRawEvent)
    expect(mockParseEvent).toHaveBeenCalledWith(testRawEvent)
  })

  test('should get event type from parsed event', async () => {
    await processEvent(testRawEvent)
    expect(mockGetEventType).toHaveBeenCalledWith(testEvent.type)
  })

  test('should validate the event payload specific to the event type', async () => {
    await processEvent(testRawEvent)
    expect(mockValidateEvent).toHaveBeenCalledWith(testEvent, 'test-event-type')
  })

  test('should save the event payload specific to the event type', async () => {
    await processEvent(testRawEvent)
    expect(mockSaveEvent).toHaveBeenCalledWith(testEvent, 'test-event-type')
  })

  test('should log successful processing of the event', async () => {
    await processEvent(testRawEvent)
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      { event: { reference: testEvent.id, type: testEvent.type } },
      'Event processed successfully'
    )
  })

  test('should abandon processing if parsing fails', async () => {
    const parseError = new Error('Test parsing error')

    mockParseEvent.mockImplementationOnce(() => {
      throw parseError
    })

    await expect(processEvent(testRawEvent)).rejects.toThrow(parseError)

    expect(mockGetEventType).not.toHaveBeenCalled()
    expect(mockValidateEvent).not.toHaveBeenCalled()
    expect(mockSaveEvent).not.toHaveBeenCalled()
  })

  test('should abandon processing if getting event type fails', async () => {
    const typeError = new Error('Test event type error')

    mockGetEventType.mockImplementationOnce(() => {
      throw typeError
    })

    await expect(processEvent(testRawEvent)).rejects.toThrow(typeError)

    expect(mockValidateEvent).not.toHaveBeenCalled()
    expect(mockSaveEvent).not.toHaveBeenCalled()
  })

  test('should abandon processing if validation fails', async () => {
    const validationError = new Error('Test validation error')

    mockValidateEvent.mockImplementationOnce(() => {
      throw validationError
    })

    await expect(processEvent(testRawEvent)).rejects.toThrow(validationError)

    expect(mockSaveEvent).not.toHaveBeenCalled()
  })
})
