import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../src/config/config.js'
import { BaseRepository } from '../../../../src/projections/base-repository.js'
import { clearAllCollections } from '../../../helpers/mongo.js'

const testDocuments = [{
  _id: 'doc-001',
  crn: 1234567890,
  sbi: 987654321,
  status: 'active',
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T10:05:00Z'),
  customField: 'value1',
  events: [{
    _id: 'source1:event-001',
    type: 'test.created',
    source: 'source1',
    id: 'event-001',
    time: '2024-01-01T10:00:00Z',
    subject: 'test-subject-1',
    received: new Date('2024-01-01T10:00:01Z')
  }]
}, {
  _id: 'doc-002',
  crn: 1234567890,
  sbi: 987654322,
  status: 'pending',
  created: new Date('2024-01-01T11:00:00Z'),
  lastUpdated: new Date('2024-01-01T11:05:00Z'),
  customField: 'value2',
  events: [{
    _id: 'source1:event-002',
    type: 'test.updated',
    source: 'source1',
    id: 'event-002',
    time: '2024-01-01T11:00:00Z',
    subject: 'test-subject-2',
    received: new Date('2024-01-01T11:00:01Z')
  }]
}, {
  _id: 'doc-003',
  crn: 1234567891,
  sbi: 987654321,
  status: 'completed',
  created: new Date('2024-01-01T12:00:00Z'),
  lastUpdated: new Date('2024-01-01T12:05:00Z'),
  customField: 'value3',
  events: [{
    _id: 'source1:event-003',
    type: 'test.completed',
    source: 'source1',
    id: 'event-003',
    time: '2024-01-01T12:00:00Z',
    subject: 'test-subject-3',
    received: new Date('2024-01-01T12:00:01Z')
  }]
}, {
  _id: 'doc-004',
  crn: 1234567891,
  sbi: 987654323,
  status: 'archived',
  created: new Date('2024-01-01T13:00:00Z'),
  lastUpdated: new Date('2024-01-01T13:05:00Z'),
  customField: 'value4',
  events: [{
    _id: 'source1:event-004',
    type: 'test.archived',
    source: 'source1',
    id: 'event-004',
    time: '2024-01-01T13:00:00Z',
    subject: 'test-subject-4',
    received: new Date('2024-01-01T13:00:01Z')
  }]
}]

const createBaseDocument = (doc) => ({
  crn: doc.crn,
  sbi: doc.sbi,
  status: doc.status,
  created: doc.created,
  lastUpdated: doc.lastUpdated
})

const createDocumentWithEvents = (doc) => ({
  ...createBaseDocument(doc),
  events: doc.events.map(({ _id, ...event }) => event)
})

const createDocumentWithCustomField = (doc) => ({
  ...createBaseDocument(doc),
  customField: doc.customField
})

let collections
let repository

beforeAll(async () => {
  await createMongoDbConnection(config.get('mongo'))

  const mongoDb = getMongoDb()
  collections = mongoDb.collections
})

beforeEach(async () => {
  await clearAllCollections(collections)
  await collections.messages.insertMany(testDocuments)
  repository = new BaseRepository('messages')
})

afterAll(async () => {
  await closeMongoDbConnection()
})

describe('BaseRepository', () => {
  describe('constructor', () => {
    test('should create repository with default base projection fields', () => {
      const repo = new BaseRepository('messages')
      expect(repo.collectionName).toBe('messages')
      expect(repo.baseProjectionFields).toHaveProperty('_id')
      expect(repo.baseProjectionFields).toHaveProperty('crn')
      expect(repo.baseProjectionFields).toHaveProperty('sbi')
      expect(repo.baseProjectionFields).toHaveProperty('status')
      expect(repo.baseProjectionFields).toHaveProperty('created')
      expect(repo.baseProjectionFields).toHaveProperty('lastUpdated')
    })

    test('should create repository with custom base projection fields', () => {
      const customFields = { _id: 1, name: 1, type: 1 }
      const repo = new BaseRepository('messages', { baseProjectionFields: customFields })
      expect(repo.baseProjectionFields).toEqual(customFields)
    })

    test('should support mapping _id to domain field via transformIdField option', () => {
      const repo = new BaseRepository('messages', { transformIdField: 'correlationId' })
      expect(repo.transformIdField).toBe('correlationId')
    })

    test('should have null transformIdField by default', () => {
      const repo = new BaseRepository('messages')
      expect(repo.transformIdField).toBeNull()
    })
  })

  describe('getCollection', () => {
    test('should provide access to underlying MongoDB collection for custom operations', () => {
      const collection = repository.getCollection()
      expect(collection).toBeDefined()
      expect(collection.collectionName).toBe('messages')
    })
  })

  describe('buildQuery', () => {
    test('should build empty query when no filters provided', () => {
      const query = repository.buildQuery()
      expect(query).toEqual({})
    })

    test('should build query with crn filter', () => {
      const query = repository.buildQuery({ crn: 1234567890 })
      expect(query).toEqual({ crn: 1234567890 })
    })

    test('should build query with sbi filter', () => {
      const query = repository.buildQuery({ sbi: 987654321 })
      expect(query).toEqual({ sbi: 987654321 })
    })

    test('should build query with both crn and sbi filters', () => {
      const query = repository.buildQuery({ crn: 1234567890, sbi: 987654321 })
      expect(query).toEqual({ crn: 1234567890, sbi: 987654321 })
    })

    test('should exclude undefined filters to avoid unnecessary query constraints', () => {
      const query = repository.buildQuery({ crn: undefined, sbi: 987654321 })
      expect(query).toEqual({ sbi: 987654321 })
    })

    test('should treat 0 as valid filter value', () => {
      const query = repository.buildQuery({ crn: 0 })
      expect(query).toEqual({ crn: 0 })
    })

    test('should ignore extra filter properties', () => {
      const query = repository.buildQuery({ crn: 1234567890, extraProp: 'ignored' })
      expect(query).toEqual({ crn: 1234567890 })
    })
  })

  describe('buildProjection', () => {
    test('should build projection with only base fields', () => {
      const projection = repository.buildProjection()
      expect(projection).toEqual(repository.baseProjectionFields)
    })

    test('should extend projection with context-specific additional fields', () => {
      const projection = repository.buildProjection({
        additionalFields: ['customField', 'anotherField']
      })
      expect(projection).toHaveProperty('_id')
      expect(projection).toHaveProperty('crn')
      expect(projection).toHaveProperty('customField', 1)
      expect(projection).toHaveProperty('anotherField', 1)
    })

    test('should include audit events in projection only when explicitly requested', () => {
      const projection = repository.buildProjection({ includeEvents: true })
      expect(projection).toHaveProperty('events', 1)
    })

    test('should exclude events from projection when explicitly disabled for performance', () => {
      const projection = repository.buildProjection({ includeEvents: false })
      expect(projection).not.toHaveProperty('events')
    })

    test('should combine additional fields and events', () => {
      const projection = repository.buildProjection({
        additionalFields: ['customField'],
        includeEvents: true
      })
      expect(projection).toHaveProperty('customField', 1)
      expect(projection).toHaveProperty('events', 1)
    })

    test('should handle empty additional fields array', () => {
      const projection = repository.buildProjection({ additionalFields: [] })
      expect(projection).toEqual(repository.baseProjectionFields)
    })
  })

  describe('transformEvents', () => {
    test('should strip MongoDB _id from events to prevent internal field exposure', () => {
      const events = [
        { _id: 'id1', type: 'test.created', data: 'value1' },
        { _id: 'id2', type: 'test.updated', data: 'value2' }
      ]
      const transformed = repository.transformEvents(events)
      expect(transformed).toEqual([
        { type: 'test.created', data: 'value1' },
        { type: 'test.updated', data: 'value2' }
      ])
    })

    test('should handle empty events array', () => {
      const transformed = repository.transformEvents([])
      expect(transformed).toEqual([])
    })
  })

  describe('transformDocument', () => {
    test('should safely return null for non-existent documents without throwing', () => {
      const transformed = repository.transformDocument(null)
      expect(transformed).toBeNull()
    })

    test('should strip MongoDB _id from document to prevent internal field exposure', () => {
      const doc = { _id: 'doc-001', field: 'value' }
      const transformed = repository.transformDocument(doc)
      expect(transformed).not.toHaveProperty('_id')
      expect(transformed).toEqual({ field: 'value' })
    })

    test('should remap _id to business domain identifier when transformIdField configured', () => {
      const repo = new BaseRepository('test', { transformIdField: 'correlationId' })
      const doc = { _id: 'doc-001', field: 'value' }
      const transformed = repo.transformDocument(doc)
      expect(transformed).not.toHaveProperty('_id')
      expect(transformed).toHaveProperty('correlationId', 'doc-001')
      expect(transformed).toHaveProperty('field', 'value')
    })

    test('should recursively clean event _id fields when includeEvents requested', () => {
      const doc = {
        _id: 'doc-001',
        field: 'value',
        events: [
          { _id: 'event-001', type: 'test.created' },
          { _id: 'event-002', type: 'test.updated' }
        ]
      }
      const transformed = repository.transformDocument(doc, { includeEvents: true })
      expect(transformed.events).toEqual([
        { type: 'test.created' },
        { type: 'test.updated' }
      ])
    })

    test('should preserve event structure as-is when includeEvents not requested', () => {
      const doc = {
        _id: 'doc-001',
        field: 'value',
        events: [
          { _id: 'event-001', type: 'test.created' }
        ]
      }
      const transformed = repository.transformDocument(doc, { includeEvents: false })
      expect(transformed.events).toEqual([
        { _id: 'event-001', type: 'test.created' }
      ])
    })

    test('should gracefully handle documents without events array', () => {
      const doc = { _id: 'doc-001', field: 'value' }
      const transformed = repository.transformDocument(doc, { includeEvents: true })
      expect(transformed).toEqual({ field: 'value' })
    })
  })

  describe('findOne', () => {
    test('should retrieve single document by filter', async () => {
      const doc = await repository.findOne({ _id: 'doc-001' })
      expect(doc).toEqual(createBaseDocument(testDocuments[0]))
    })

    test('should return null for non-existent document', async () => {
      const doc = await repository.findOne({ _id: 'non-existent' })
      expect(doc).toBeNull()
    })

    test('should include events when requested', async () => {
      const doc = await repository.findOne({ _id: 'doc-001' }, { includeEvents: true })
      expect(doc).toEqual(createDocumentWithEvents(testDocuments[0]))
    })

    test('should project additional fields when requested', async () => {
      const doc = await repository.findOne(
        { _id: 'doc-001' },
        { additionalFields: ['customField'] }
      )
      expect(doc).toEqual(createDocumentWithCustomField(testDocuments[0]))
    })

    test('should transform _id to custom field when configured', async () => {
      const repo = new BaseRepository('messages', { transformIdField: 'correlationId' })
      const doc = await repo.findOne({ _id: 'doc-001' })
      expect(doc).not.toHaveProperty('_id')
      expect(doc).toHaveProperty('correlationId', 'doc-001')
    })

    test('should handle filter with multiple conditions', async () => {
      const doc = await repository.findOne({ crn: 1234567890, sbi: 987654321 })
      expect(doc).toEqual(createBaseDocument(testDocuments[0]))
    })
  })

  describe('findMany', () => {
    test('should retrieve all documents without filters', async () => {
      const docs = await repository.findMany()
      expect(docs).toEqual(expect.arrayContaining(testDocuments.map(createBaseDocument)))
      expect(docs).toHaveLength(4)
    })

    test('should filter documents by crn', async () => {
      const docs = await repository.findMany({ crn: 1234567890 })
      const expected = testDocuments.filter(doc => doc.crn === 1234567890)
      expect(docs).toEqual(expect.arrayContaining(expected.map(createBaseDocument)))
      expect(docs).toHaveLength(2)
    })

    test('should filter documents by sbi', async () => {
      const docs = await repository.findMany({ sbi: 987654321 })
      const expected = testDocuments.filter(doc => doc.sbi === 987654321)
      expect(docs).toEqual(expect.arrayContaining(expected.map(createBaseDocument)))
      expect(docs).toHaveLength(2)
    })

    test('should filter documents by crn and sbi', async () => {
      const docs = await repository.findMany({ crn: 1234567890, sbi: 987654321 })
      const expected = testDocuments.filter(doc => doc.crn === 1234567890 && doc.sbi === 987654321)
      expect(docs).toEqual(expected.map(createBaseDocument))
      expect(docs).toHaveLength(1)
    })

    test('should return empty array when no documents match filter', async () => {
      const docs = await repository.findMany({ crn: 9999999999 })
      expect(docs).toEqual([])
      expect(docs).toHaveLength(0)
    })

    test('should include events when requested', async () => {
      const docs = await repository.findMany({}, { includeEvents: true })
      expect(docs).toEqual(expect.arrayContaining(testDocuments.map(createDocumentWithEvents)))
      expect(docs).toHaveLength(4)
    })

    test('should include additional fields when requested', async () => {
      const docs = await repository.findMany({}, { additionalFields: ['customField'] })
      expect(docs).toEqual(expect.arrayContaining(testDocuments.map(createDocumentWithCustomField)))
      expect(docs).toHaveLength(4)
    })

    test('should return documents newest-first by default for consistent ordering', async () => {
      const docs = await repository.findMany()
      const sorted = [...docs].sort((a, b) => b.created - a.created)
      expect(docs).toEqual(sorted)
    })

    test('should paginate results with page and pageSize', async () => {
      const sorted = [...testDocuments].sort((a, b) => b.created - a.created)
      const docs = await repository.findMany({ page: 1, pageSize: 2 })
      expect(docs).toEqual([
        createBaseDocument(sorted[0]),
        createBaseDocument(sorted[1])
      ])
      expect(docs).toHaveLength(2)
    })

    test('should return second page of results', async () => {
      const sorted = [...testDocuments].sort((a, b) => b.created - a.created)
      const docs = await repository.findMany({ page: 2, pageSize: 2 })
      expect(docs).toEqual([
        createBaseDocument(sorted[2]),
        createBaseDocument(sorted[3])
      ])
      expect(docs).toHaveLength(2)
    })

    test('should default to page 1 if not specified', async () => {
      const docs = await repository.findMany({ pageSize: 2 })
      expect(docs).toHaveLength(2)
    })

    test('should default to pageSize 20 if not specified', async () => {
      const docs = await repository.findMany()
      expect(docs).toHaveLength(4) // Less than default page size
    })

    test('should combine filtering with pagination', async () => {
      const docs = await repository.findMany({ crn: 1234567890, page: 1, pageSize: 1 })
      expect(docs).toHaveLength(1)
      expect(docs[0].crn).toBe(1234567890)
    })

    test('should combine filtering with events inclusion', async () => {
      const docs = await repository.findMany({ crn: 1234567890 }, { includeEvents: true })
      const expected = testDocuments.filter(doc => doc.crn === 1234567890)
      expect(docs).toEqual(expect.arrayContaining(expected.map(createDocumentWithEvents)))
      expect(docs).toHaveLength(2)
    })

    test('should transform _id to custom field when configured', async () => {
      const repo = new BaseRepository('messages', { transformIdField: 'correlationId' })
      const docs = await repo.findMany({ page: 1, pageSize: 1 })
      expect(docs).toHaveLength(1)
      expect(docs[0]).not.toHaveProperty('_id')
      expect(docs[0]).toHaveProperty('correlationId')
    })
  })
})
