import { vi, describe, beforeEach, test, expect } from 'vitest'

const mockSaveMessageEvent = vi.fn()

vi.mock('../../../src/events/save/message.js', () => ({
  saveMessageEvent: mockSaveMessageEvent
}))

vi.mock('../../../src/events/types.js', () => ({
  eventTypes: {
    MESSAGE_EVENT: 'message'
  }
}))

const { saveEvent } = await import('../../../src/events/save.js')

const testEvent = {
  type: 'uk.gov.fcp.sfd.notification.event'
}

describe('saveEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should call saveMessageEvent for Single Front Door Comms message type', async () => {
    await saveEvent(testEvent, 'message')
    expect(mockSaveMessageEvent).toHaveBeenCalledWith(testEvent)
  })

  test('should throw error for unknown event type', async () => {
    await expect(saveEvent(testEvent, 'unknown-type')).rejects.toThrow('Unknown event type: unknown-type')
    expect(mockSaveMessageEvent).not.toHaveBeenCalled()
  })
})
