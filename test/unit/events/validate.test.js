import { describe, test, expect, beforeEach, vi } from 'vitest'

const mockSchemaValidate = vi.fn()

vi.mock('../../../src/events/schemas/message.js', () => ({
  default: {
    validate: mockSchemaValidate
  }
}))

let validateEvent

const testEvent = {
  type: 'uk.gov.defra.fcp.event'
}

const testEventType = 'message'

describe('validateEvent', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockSchemaValidate.mockReturnValue({ error: null })
    validateEvent = (await import('../../../src/events/validate.js')).validateEvent
  })

  test('should validate all event payload properties against schema allowing unknown properties', async () => {
    await validateEvent(testEvent, testEventType)
    expect(mockSchemaValidate).toHaveBeenCalledWith(testEvent, { abortEarly: false, allowUnknown: true })
  })

  test('should throw error if event validation fails', async () => {
    const validationError = new Error('Validation failed')
    mockSchemaValidate.mockReturnValueOnce({ error: validationError })

    await expect(validateEvent(testEvent, testEventType)).rejects.toThrow(`Event is invalid, ${validationError.message}`)
  })
})
