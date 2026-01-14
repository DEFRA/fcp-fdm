import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../src/common/helpers/mongodb.js'
import { config } from '../../../src/config/config.js'
import { clearAllCollections } from '../../helpers/mongo.js'
import { getScenario } from '../scenarios.js'
import { processScenarioEvents } from '../../helpers/scenarios.js'

let collections

describe('document event scenarios', () => {
  beforeAll(async () => {
    await createMongoDbConnection(config.get('mongo'))

    const mongoDb = getMongoDb()
    collections = mongoDb.collections
  })

  beforeEach(async () => {
    await clearAllCollections(collections)

    const events = await collections.events.find({}).toArray()
    expect(events).toHaveLength(0)

    const documents = await collections.documents.find({}).toArray()
    expect(documents).toHaveLength(0)
  })

  afterAll(async () => {
    await closeMongoDbConnection()
  })

  test('should process a document upload scenario', async () => {
    await processScenarioEvents(getScenario('single.documentUploaded'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(1)

    const savedDocuments = await collections.documents.find({}).toArray()
    expect(savedDocuments).toHaveLength(1)
    expect(savedDocuments[0].events.length).toBe(1)
    expect(savedDocuments[0].file.fileId).toBe('file-123')
  })

  test('should process multiple document events for same correlation', async () => {
    await processScenarioEvents(getScenario('streams.documentUploadedAndDeleted'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(2)

    const savedDocuments = await collections.documents.find({}).toArray()
    expect(savedDocuments).toHaveLength(1)
    expect(savedDocuments[0].events.length).toBe(2)
  })
})
