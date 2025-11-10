import { vi, describe, beforeEach, test, expect } from 'vitest'

const mockSave = vi.fn()
const mockNoSave = vi.fn()

vi.mock('../../../src/events/save/message.js', () => ({
  save: mockSave
}))

vi.mock('../../../src/events/save/no-save.js', () => ({
  save: mockNoSave
}))

const mockConfigGet = vi.fn()

vi.mock('../../../src/config/config.js', () => ({
  config: {
    get: mockConfigGet
  }
}))

const { saveEvent } = await import('../../../src/events/save.js')

const testEvent = {
  type: 'uk.gov.fcp.sfd.notification.event'
}

describe('saveEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfigGet.mockReturnValue(true)
  })

  test('should save event with message save function for message event type', async () => {
    await saveEvent(testEvent, 'message')
    expect(mockSave).toHaveBeenCalledWith(testEvent)
  })

  test('should not save event for messageRejected event type', async () => {
    await saveEvent(testEvent, 'messageRejected')
    expect(mockNoSave).toHaveBeenCalledWith(testEvent)
  })

  test('should throw error when trying to import non-existent event type module', async () => {
    await expect(saveEvent(testEvent, 'unknown-type')).rejects.toThrow()
  })

  test('should not save event when data persistence is disabled in config', async () => {
    mockConfigGet.mockReturnValue(false)

    await saveEvent(testEvent, 'message')
    expect(mockNoSave).toHaveBeenCalledWith(testEvent)
    expect(mockSave).not.toHaveBeenCalled()
  })
})
