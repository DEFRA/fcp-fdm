import { describe, beforeEach, test, expect } from 'vitest'

import schema from '../../../../src/events/schemas/cloud-event.js'

const eventPayload = {
  specversion: '1.0',
  type: 'uk.gov.defra.fcp.notification.event',
  source: 'fcp-sfd-comms',
  id: 'f39deb76-bd15-4532-8efb-92783800847e',
  time: '2025-10-19T12:34:56Z',
  subject: 'New Notification Event',
  datacontenttype: 'text/json',
  data: {
    message: 'This is a test notification event'
  }
}

let event

describe('cloud event schema', () => {
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

  test('should validate an event with undefined data', () => {
    event.data = undefined
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should validate an event with null data', () => {
    event.data = null
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should validate an event with missing data', () => {
    delete event.data
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should validate an event with empty data', () => {
    event.data = ''
    expect(schema.validate(event).error).toBeUndefined()
  })
})
