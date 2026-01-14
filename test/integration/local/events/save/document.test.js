import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../../src/config/config.js'
import { documentUpload, documentDeleted } from '../../../../mocks/events.js'
import { save } from '../../../../../src/events/save/document.js'
import { clearAllCollections } from '../../../../helpers/mongo.js'
import { eventTypePrefixes } from '../../../../../src/events/types.js'

const { DOCUMENT_EVENT_PREFIX } = eventTypePrefixes

const documentEvents = {
  documentUpload,
  documentDeleted
}

let collections

describe('save', () => {
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

  test.for(Object.keys(documentEvents))('should save event to event collection for %s with composite _id', async (eventName) => {
    const event = documentEvents[eventName]

    await save(event)

    const savedEvent = await collections.events.findOne({ _id: `${event.source}:${event.id}` })

    expect(savedEvent).toBeDefined()
    expect(savedEvent.id).toBe(event.id)
  })

  test.for(Object.keys(documentEvents))('should save new event aggregation document for %s if first event for correlationId:fileId', async (eventName) => {
    const event = documentEvents[eventName]

    await save(event)

    const savedDocument = await collections.documents.findOne({
      _id: `${event.data.correlationId}:${event.data.file.fileId}`
    })

    expect(savedDocument).toBeDefined()
    expect(savedDocument.fileId).toBe(event.data.file.fileId)
    expect(savedDocument.fileName).toBe(event.data.file.fileName)
    expect(savedDocument.correlationId).toBe(event.data.correlationId)
    expect(savedDocument.crn).toBe(event.data.crn)
    expect(savedDocument.sbi).toBe(event.data.sbi)
    expect(savedDocument.events).toHaveLength(1)
    expect(savedDocument.events[0]._id).toBe(`${event.source}:${event.id}`)
  })

  test.for(Object.keys(documentEvents))('should save status for new event aggregation document for %s if first event for correlationId:fileId', async (eventName) => {
    const event = documentEvents[eventName]
    const expectedStatus = documentEvents[eventName].type.replace(`${DOCUMENT_EVENT_PREFIX}`, '')

    await save(event)

    const savedDocument = await collections.documents.findOne({
      _id: `${event.data.correlationId}:${event.data.file.fileId}`
    })

    expect(savedDocument).toBeDefined()
    expect(savedDocument.status).toBe(expectedStatus)
  })

  test.for(Object.keys(documentEvents))('should update existing event aggregation document for %s if subsequent event for correlationId:fileId', async (eventName) => {
    const event = documentEvents[eventName]
    // Save first event
    await save(event)

    // Create a second event with the same correlationId and fileId
    const secondEvent = {
      ...event,
      id: `${event.id}-second`,
      type: `${event.type}-2`,
      time: new Date(new Date(event.time).getTime() + 1000).toISOString()
    }

    await save(secondEvent)

    const expectedStatus = secondEvent.type.replace(`${DOCUMENT_EVENT_PREFIX}`, '')

    const updatedDocument = await collections.documents.findOne({
      _id: `${event.data.correlationId}:${event.data.file.fileId}`
    })

    expect(updatedDocument).toBeDefined()
    expect(updatedDocument.fileId).toBe(event.data.file.fileId)
    expect(updatedDocument.fileName).toBe(event.data.file.fileName)
    expect(updatedDocument.events).toHaveLength(2)
    expect(updatedDocument.events[1]._id).toBe(`${secondEvent.source}:${secondEvent.id}`)
    expect(updatedDocument.status).toBe(expectedStatus)
  })

  test.for(Object.keys(documentEvents))('should not update existing document status for %s if subsequent event for correlationId:fileId if later event exists', async (eventName) => {
    const event = documentEvents[eventName]
    // Save first event
    await save(event)

    // Create a second event with the same correlationId and fileId but earlier time
    const secondEvent = {
      ...event,
      id: `${event.id}-second`,
      time: new Date(new Date(event.time).getTime() - 1000).toISOString()
    }

    await save(secondEvent)

    const expectedStatus = event.type.replace(`${DOCUMENT_EVENT_PREFIX}`, '')

    const updatedDocument = await collections.documents.findOne({
      _id: `${event.data.correlationId}:${event.data.file.fileId}`
    })

    expect(updatedDocument).toBeDefined()
    expect(updatedDocument.fileId).toBe(event.data.file.fileId)
    expect(updatedDocument.fileName).toBe(event.data.file.fileName)
    expect(updatedDocument.events).toHaveLength(2)
    expect(updatedDocument.events[1]._id).toBe(`${secondEvent.source}:${secondEvent.id}`)
    expect(updatedDocument.status).toBe(expectedStatus)
  })

  test.for(Object.keys(documentEvents))('should not update event or document collections if duplicate %s event', async (eventName) => {
    const event = documentEvents[eventName]
    // Save first event
    await save(event)

    // Attempt to save duplicate event
    await save(event)

    const eventsCount = await collections.events.countDocuments({ _id: `${event.source}:${event.id}` })
    expect(eventsCount).toBe(1)

    const documentsCount = await collections.documents.countDocuments({
      _id: `${event.data.correlationId}:${event.data.file.fileId}`
    })
    expect(documentsCount).toBe(1)
  })

  test('should update fileName if provided in subsequent events', async () => {
    const event = documentUpload
    await save(event)

    const updateEvent = {
      ...documentDeleted,
      id: `${documentDeleted.id}-update`,
      time: new Date(new Date(documentDeleted.time).getTime() + 1000).toISOString(),
      data: {
        ...documentDeleted.data,
        file: {
          ...documentDeleted.data.file,
          fileName: 'updated-document.pdf'
        }
      }
    }

    await save(updateEvent)

    const savedDocument = await collections.documents.findOne({
      _id: `${event.data.correlationId}:${event.data.file.fileId}`
    })

    expect(savedDocument).toBeDefined()
    expect(savedDocument.fileName).toBe(updateEvent.data.file.fileName)
  })

  test('should store complete file object data in subsequent events', async () => {
    const event = documentUpload
    await save(event)

    const updateEvent = {
      ...documentDeleted,
      id: `${documentDeleted.id}-update`,
      time: new Date(new Date(documentDeleted.time).getTime() + 1000).toISOString(),
      data: {
        ...documentDeleted.data,
        file: {
          ...documentDeleted.data.file,
          url: 'https://example.com/updated-document.pdf'
        }
      }
    }

    await save(updateEvent)

    const savedDocument = await collections.documents.findOne({
      _id: `${event.data.correlationId}:${event.data.file.fileId}`
    })

    expect(savedDocument).toBeDefined()
    expect(savedDocument.file.url).toBe(updateEvent.data.file.url)
  })
})
