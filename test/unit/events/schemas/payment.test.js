import { describe, beforeEach, test, expect } from 'vitest'

import schema from '../../../../src/events/schemas/payment.js'

const eventPayload = {
  specversion: '1.0',
  type: 'uk.gov.defra.ffc.pay.payment.processed',
  source: 'ffc-pay-processing',
  id: 'f39deb76-bd15-4532-8efb-92783800847e',
  time: '2025-10-19T12:34:56Z',
  subject: 'New Payment Event',
  datacontenttype: 'text/json',
  data: {
    correlationId: '123e4567-e89b-12d3-a456-426614174000',
    frn: 1234567890,
    sbi: 123456789,
    schemeId: 1,
    invoiceNumber: 'INV-2025-001'
  }
}

let event

describe('payment event schema', () => {
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
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing schemeId', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing invoiceNumber', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: 1
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty correlationId', () => {
    event.data = {
      correlationId: '',
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null correlationId', () => {
    event.data = {
      correlationId: null,
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined correlationId', () => {
    event.data = {
      correlationId: undefined,
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string correlationId', () => {
    event.data = {
      correlationId: 12345,
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-guid correlationId', () => {
    event.data = {
      correlationId: 'not-a-guid',
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty invoiceNumber', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: ''
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null invoiceNumber', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: null
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined invoiceNumber', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: undefined
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string invoiceNumber', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: 12345
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null schemeId', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: null,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined schemeId', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: undefined,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-integer schemeId', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: 'not-a-number',
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with negative schemeId', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: -1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with zero schemeId', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: 0,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should validate an event with only frn as customer identifier', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should validate an event with only sbi as customer identifier', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      sbi: 123456789,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should validate an event with only trader as customer identifier', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      trader: 'TRADER123',
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should validate an event with only vendor as customer identifier', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      vendor: 'VENDOR456',
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should not validate an event with no customer identifier', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty string customer identifiers', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: '',
      sbi: '',
      trader: '',
      vendor: '',
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null customer identifiers', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: null,
      sbi: null,
      trader: null,
      vendor: null,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should validate an event with frn and sbi', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      sbi: 123456789,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should validate an event with all customer identifiers', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 1234567890,
      sbi: 123456789,
      trader: 'TRADER123',
      vendor: 'VENDOR456',
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeUndefined()
  })

  test('should not validate an event with negative frn', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: -1234567890,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with negative sbi', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      sbi: -123456789,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-integer frn', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      frn: 123.45,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-integer sbi', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      sbi: 123.45,
      schemeId: 1,
      invoiceNumber: 'INV-2025-001'
    }
    expect(schema.validate(event).error).toBeDefined()
  })
})
