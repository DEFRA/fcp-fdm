import { describe, beforeEach, test, expect } from 'vitest'

import schema from '../../../../src/events/schemas/crm.js'

const eventPayload = {
  specversion: '1.0',
  type: 'uk.gov.defra.fcp.crm.event',
  source: 'fcp-sfd-crm',
  id: 'f39deb76-bd15-4532-8efb-92783800847e',
  time: '2025-10-19T12:34:56Z',
  subject: 'New CRM Event',
  datacontenttype: 'text/json',
  data: {
    correlationId: '123e4567-e89b-12d3-a456-426614174000',
    crn: 1234567890,
    sbi: 123456789,
    caseId: 'case-123',
    caseType: 'inquiry'
  }
}

let event

describe('crm event schema', () => {
  beforeEach(() => {
    event = structuredClone(eventPayload)
  })

  test('should validate a valid event', () => {
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should not validate an event with an undefined specversion', () => {
    event.specversion = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with a null specversion', () => {
    event.specversion = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an missing specversion', () => {
    delete event.specversion
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an empty specversion', () => {
    event.specversion = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an undefined type', () => {
    event.type = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with a null type', () => {
    event.type = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an missing type', () => {
    delete event.type
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an empty type', () => {
    event.type = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an undefined source', () => {
    event.source = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with a null source', () => {
    event.source = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an missing source', () => {
    delete event.source
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an empty source', () => {
    event.source = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an undefined id', () => {
    event.id = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with a null id', () => {
    event.id = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an missing id', () => {
    delete event.id
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an empty id', () => {
    event.id = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-uuid id', () => {
    event.id = 'a-non-uuid'
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an undefined time', () => {
    event.time = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with a null time', () => {
    event.time = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an missing time', () => {
    delete event.time
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an empty time', () => {
    event.time = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with an invalid time', () => {
    event.time = 'a-non-date'
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should validate an event with an undefined subject', () => {
    event.subject = undefined
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should not validate an event with a null subject', () => {
    event.subject = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should validate an event with an missing subject', () => {
    delete event.subject
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should not validate an event with an empty subject', () => {
    event.subject = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should validate an event with an undefined datacontenttype', () => {
    event.datacontenttype = undefined
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should not validate an event with a null datacontenttype', () => {
    event.datacontenttype = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should validate an event with an missing datacontenttype', () => {
    delete event.datacontenttype
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should not validate an event with an empty datacontenttype', () => {
    event.datacontenttype = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined data', () => {
    event.data = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null data', () => {
    event.data = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with missing data', () => {
    delete event.data
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty string data', () => {
    event.data = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty object data', () => {
    event.data = {}
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing correlationId', () => {
    event.data = {
      crn: 1234567890,
      sbi: 123456789,
      caseId: 'case-123',
      caseType: 'inquiry'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing crn', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      sbi: 123456789,
      caseId: 'case-123',
      caseType: 'inquiry'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing sbi', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      crn: 1234567890,
      caseId: 'case-123',
      caseType: 'inquiry'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing caseId', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      crn: 1234567890,
      sbi: 123456789,
      caseType: 'inquiry'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing caseType', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      crn: 1234567890,
      sbi: 123456789,
      caseId: 'case-123'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty correlationId', () => {
    event.data.correlationId = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null correlationId', () => {
    event.data.correlationId = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined correlationId', () => {
    event.data.correlationId = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string correlationId', () => {
    event.data.correlationId = 12345
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null crn', () => {
    event.data.crn = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined crn', () => {
    event.data.crn = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null sbi', () => {
    event.data.sbi = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined sbi', () => {
    event.data.sbi = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty caseId', () => {
    event.data.caseId = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null caseId', () => {
    event.data.caseId = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined caseId', () => {
    event.data.caseId = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string caseId', () => {
    event.data.caseId = 12345
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty caseType', () => {
    event.data.caseType = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null caseType', () => {
    event.data.caseType = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined caseType', () => {
    event.data.caseType = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string caseType', () => {
    event.data.caseType = 12345
    expect(schema.validate(event).error).toBeDefined()
  })
})
