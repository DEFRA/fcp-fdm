import { describe, test, expect } from 'vitest'

import { parseEvent } from '../../../src/events/parse.js'

const testEvent = {
  type: 'uk.gov.defra.fcp.event'
}

const testRawEvent = {
  Body: JSON.stringify({
    Message: JSON.stringify(testEvent)
  })
}

describe('parseEvent', () => {
  test('should parse the raw event into a JSON object', () => {
    const result = parseEvent(testRawEvent)
    expect(result).toEqual(testEvent)
  })

  test('should throw an error for invalid Body JSON', () => {
    const invalidRawEvent = {
      Body: 'invalid-json'
    }
    expect(() => parseEvent(invalidRawEvent)).toThrow()
  })

  test('should throw an error for missing Message field', () => {
    const invalidRawEvent = {
      Body: JSON.stringify({
        // Message field is missing
      })
    }
    expect(() => parseEvent(invalidRawEvent)).toThrow()
  })

  test('should throw an error for invalid Message JSON', () => {
    const invalidRawEvent = {
      Body: JSON.stringify({
        Message: 'invalid-json'
      })
    }
    expect(() => parseEvent(invalidRawEvent)).toThrow()
  })
})
