import { vi, describe, beforeEach, test, expect } from 'vitest'

const mockSave = vi.fn()

vi.mock('../../../src/events/save/message.js', () => ({
  save: mockSave
}))

const { saveEvent } = await import('../../../src/events/save.js')

const testEvent = {
  type: 'uk.gov.fcp.sfd.notification.event'
}

describe('saveEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should dynamically import and call save function for message event type', async () => {
    await saveEvent(testEvent, 'message')
    expect(mockSave).toHaveBeenCalledWith(testEvent)
  })

  test('should throw error when trying to import non-existent event type module', async () => {
    await expect(saveEvent(testEvent, 'unknown-type')).rejects.toThrow()
  })
})
