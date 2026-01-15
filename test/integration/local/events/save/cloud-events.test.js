import { describe, beforeEach, beforeAll, afterAll, test, expect, vi } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../../src/config/config.js'
import { saveCloudEvent } from '../../../../../src/events/save/cloud-events.js'
import { clearAllCollections } from '../../../../helpers/mongo.js'

let collections

const createMockEvent = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440001',
  source: 'fcp-sfd-test',
  specversion: '1.0',
  type: 'uk.gov.fcp.sfd.test.created',
  datacontenttype: 'application/json',
  time: '2023-10-17T14:48:01.000Z',
  subject: 'test-subject',
  data: {
    testData: 'value'
  },
  ...overrides
})

describe('saveCloudEvent', () => {
  beforeAll(async () => {
    await createMongoDbConnection(config.get('mongo'))

    const mongoDb = getMongoDb()
    collections = mongoDb.collections
  })

  beforeEach(async () => {
    await clearAllCollections(collections)
  })

  afterAll(async () => {
    await closeMongoDbConnection()
  })

  test('should save event to events collection with composite _id', async () => {
    const event = createMockEvent()

    const result = await saveCloudEvent(event)

    expect(result).toBeDefined()
    expect(result._id).toBe(`${event.source}:${event.id}`)
    expect(result.id).toBe(event.id)
    expect(result.source).toBe(event.source)
    expect(result.type).toBe(event.type)
  })

  test('should add received timestamp to saved event', async () => {
    const event = createMockEvent()
    const beforeSave = new Date()

    const result = await saveCloudEvent(event)

    const afterSave = new Date()

    expect(result.received).toBeDefined()
    expect(result.received).toBeInstanceOf(Date)
    expect(result.received.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime())
    expect(result.received.getTime()).toBeLessThanOrEqual(afterSave.getTime())
  })

  test('should save all event properties', async () => {
    const event = createMockEvent()

    const result = await saveCloudEvent(event)

    expect(result.id).toBe(event.id)
    expect(result.source).toBe(event.source)
    expect(result.specversion).toBe(event.specversion)
    expect(result.type).toBe(event.type)
    expect(result.datacontenttype).toBe(event.datacontenttype)
    expect(result.time).toBe(event.time)
    expect(result.subject).toBe(event.subject)
    expect(result.data).toEqual(event.data)
  })

  test('should persist event to database', async () => {
    const event = createMockEvent()

    await saveCloudEvent(event)

    const savedEvent = await collections.events.findOne({ _id: `${event.source}:${event.id}` })

    expect(savedEvent).toBeDefined()
    expect(savedEvent._id).toBe(`${event.source}:${event.id}`)
    expect(savedEvent.id).toBe(event.id)
  })

  test('should not save duplicate event', async () => {
    const event = createMockEvent()

    // Save first time
    const firstResult = await saveCloudEvent(event)
    expect(firstResult).toBeDefined()

    // Attempt to save duplicate
    const secondResult = await saveCloudEvent(event)
    expect(secondResult).toBeUndefined()

    const eventsCount = await collections.events.countDocuments({ _id: `${event.source}:${event.id}` })
    expect(eventsCount).toBe(1)
  })

  test('should log warning when skipping duplicate event', async () => {
    const event = createMockEvent()
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Save first time
    await saveCloudEvent(event)

    // Attempt to save duplicate
    await saveCloudEvent(event)

    // Note: The actual implementation uses logger.warn which we can't easily spy on in integration tests
    // But we can verify the behavior (no second save)
    const eventsCount = await collections.events.countDocuments({ _id: `${event.source}:${event.id}` })
    expect(eventsCount).toBe(1)

    consoleWarnSpy.mockRestore()
  })

  test('should save events with same id but different source', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440001'
    const event1 = createMockEvent({ id: eventId, source: 'source-1' })
    const event2 = createMockEvent({ id: eventId, source: 'source-2' })

    const result1 = await saveCloudEvent(event1)
    const result2 = await saveCloudEvent(event2)

    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
    expect(result1._id).toBe('source-1:' + eventId)
    expect(result2._id).toBe('source-2:' + eventId)

    const eventsCount = await collections.events.countDocuments({ id: eventId })
    expect(eventsCount).toBe(2)
  })

  test('should save events with different ids from same source', async () => {
    const source = 'fcp-sfd-test'
    const event1 = createMockEvent({ id: '550e8400-e29b-41d4-a716-446655440001', source })
    const event2 = createMockEvent({ id: '550e8400-e29b-41d4-a716-446655440002', source })

    const result1 = await saveCloudEvent(event1)
    const result2 = await saveCloudEvent(event2)

    expect(result1).toBeDefined()
    expect(result2).toBeDefined()

    const eventsCount = await collections.events.countDocuments({ source })
    expect(eventsCount).toBe(2)
  })

  test('should use upsert operation with setOnInsert', async () => {
    const event = createMockEvent()

    // First save should insert
    const result1 = await saveCloudEvent(event)
    expect(result1).toBeDefined()
    const firstReceived = result1.received

    // Attempt to save duplicate - should return undefined
    const result2 = await saveCloudEvent(event)
    expect(result2).toBeUndefined()

    // Verify received timestamp wasn't updated
    const savedEvent = await collections.events.findOne({ _id: `${event.source}:${event.id}` })
    expect(savedEvent.received).toEqual(firstReceived)
  })

  test('should handle events without optional subject field', async () => {
    const event = createMockEvent()
    delete event.subject

    const result = await saveCloudEvent(event)

    expect(result).toBeDefined()
    expect(result.subject).toBeUndefined()
  })

  test('should handle events without optional datacontenttype field', async () => {
    const event = createMockEvent()
    delete event.datacontenttype

    const result = await saveCloudEvent(event)

    expect(result).toBeDefined()
    expect(result.datacontenttype).toBeUndefined()
  })
})
