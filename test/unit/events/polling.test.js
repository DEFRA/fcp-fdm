import { vi, describe, beforeEach, test, expect } from 'vitest'

vi.useFakeTimers()

const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {})

const mockConsumeEvents = vi.fn()

vi.mock('../../../src/events/consumer.js', () => ({
  consumeEvents: mockConsumeEvents
}))

vi.mock('../../../src/config/config.js', () => ({
  config: {
    get: (key) => {
      if (key === 'aws') {
        return {
          sqs: {
            pollingInterval: 1000
          }
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

const { pollForEvents } = await import('../../../src/events/polling.js')

describe('pollForEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should trigger event consumption and schedule next poll if returns true', async () => {
    mockConsumeEvents.mockResolvedValueOnce(true)
    await pollForEvents()
    expect(mockConsumeEvents).toHaveBeenCalled()
    expect(setTimeoutSpy).toHaveBeenCalledWith(pollForEvents, expect.any(Number))
  })

  test('should schedule next poll if consumption returns false', async () => {
    mockConsumeEvents.mockResolvedValueOnce(false)
    await pollForEvents()
    vi.runAllTimers()
    expect(mockConsumeEvents).toHaveBeenCalled()
    expect(setTimeoutSpy).toHaveBeenCalledWith(pollForEvents, expect.any(Number))
  })

  test('should log error and still schedule next poll if consumption throws error', async () => {
    const testError = new Error('Test consumption error')
    mockConsumeEvents.mockRejectedValueOnce(testError)
    await pollForEvents()
    vi.runAllTimers()
    expect(mockLogError).toHaveBeenCalledWith(testError, 'Error polling for event messages')
    expect(setTimeoutSpy).toHaveBeenCalledWith(pollForEvents, expect.any(Number))
  })
})
