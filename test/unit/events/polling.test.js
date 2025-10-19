import { vi, describe, beforeEach, test, expect } from 'vitest'

vi.useFakeTimers()

const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {})

const mockConsumeEvents = vi.fn()

vi.mock('../../../src/events/consumer.js', () => ({
  consumeEvents: mockConsumeEvents
}))

vi.mock('../../../src/config.js', () => ({
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

  test('should trigger event consumption', async () => {
    await pollForEvents()
    expect(mockConsumeEvents).toHaveBeenCalled()
  })

  test('should trigger polling again after configured interval if consumption does not throw error', async () => {
    await pollForEvents()
    expect(setTimeoutSpy).toHaveBeenCalledWith(pollForEvents, 1000)
  })

  test('should log error and still schedule next poll if consumption throws error', async () => {
    const testError = new Error('Test consumption error')
    mockConsumeEvents.mockRejectedValueOnce(testError)

    await pollForEvents()

    expect(mockLogError).toHaveBeenCalledWith(testError, 'Error polling for event messages')
    expect(setTimeoutSpy).toHaveBeenCalledWith(pollForEvents, 1000)
  })
})
