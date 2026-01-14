import { describe, beforeEach, test, expect } from 'vitest'

import schema from '../../../../src/events/schemas/document.js'

const eventPayload = {
  specversion: '1.0',
  type: 'uk.gov.defra.fcp.document.event',
  source: 'fcp-document-service',
  id: 'f39deb76-bd15-4532-8efb-92783800847e',
  time: '2025-10-19T12:34:56Z',
  subject: 'New Document Event',
  datacontenttype: 'text/json',
  data: {
    correlationId: '123e4567-e89b-12d3-a456-426614174000',
    crn: 1234567890,
    sbi: 123456789,
    file: {
      fileId: 'file-123',
      fileName: 'document.pdf',
      contentType: 'application/pdf',
      url: 'https://example.com/document.pdf'
    }
  }
}

let event

describe('document event schema', () => {
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
      file: {
        fileId: 'file-123',
        fileName: 'document.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/document.pdf'
      }
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing crn', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      sbi: 123456789,
      file: {
        fileId: 'file-123',
        fileName: 'document.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/document.pdf'
      }
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing sbi', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      crn: 1234567890,
      file: {
        fileId: 'file-123',
        fileName: 'document.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/document.pdf'
      }
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with data missing file', () => {
    event.data = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      crn: 1234567890,
      sbi: 123456789
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

  test('should not validate an event with null file', () => {
    event.data.file = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined file', () => {
    event.data.file = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty object file', () => {
    event.data.file = {}
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with file missing fileId', () => {
    event.data.file = {
      fileName: 'document.pdf',
      contentType: 'application/pdf',
      url: 'https://example.com/document.pdf'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with file missing fileName', () => {
    event.data.file = {
      fileId: 'file-123',
      contentType: 'application/pdf',
      url: 'https://example.com/document.pdf'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with file missing contentType', () => {
    event.data.file = {
      fileId: 'file-123',
      fileName: 'document.pdf',
      url: 'https://example.com/document.pdf'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with file missing url', () => {
    event.data.file = {
      fileId: 'file-123',
      fileName: 'document.pdf',
      contentType: 'application/pdf'
    }
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty fileId', () => {
    event.data.file.fileId = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null fileId', () => {
    event.data.file.fileId = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined fileId', () => {
    event.data.file.fileId = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string fileId', () => {
    event.data.file.fileId = 12345
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty fileName', () => {
    event.data.file.fileName = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null fileName', () => {
    event.data.file.fileName = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined fileName', () => {
    event.data.file.fileName = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string fileName', () => {
    event.data.file.fileName = 12345
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty contentType', () => {
    event.data.file.contentType = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null contentType', () => {
    event.data.file.contentType = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined contentType', () => {
    event.data.file.contentType = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string contentType', () => {
    event.data.file.contentType = 12345
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with empty url', () => {
    event.data.file.url = ''
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with null url', () => {
    event.data.file.url = null
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with undefined url', () => {
    event.data.file.url = undefined
    expect(schema.validate(event).error).toBeDefined()
  })

  test('should not validate an event with non-string url', () => {
    event.data.file.url = 12345
    expect(schema.validate(event).error).toBeDefined()
  })
})
