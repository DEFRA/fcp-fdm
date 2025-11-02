import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../src/common/helpers/mongodb.js'
import { config } from '../../../src/config/config.js'
import { clearAllCollections } from '../../helpers/mongo.js'
import { getScenario } from '../scenarios.js'
import { processScenarioEvents } from '../../helpers/scenarios.js'

let collections

describe('message event scenarios', () => {
  beforeAll(async () => {
    await createMongoDbConnection(config.get('mongo'))

    const mongoDb = getMongoDb()
    collections = mongoDb.collections
  })

  beforeEach(async () => {
    await clearAllCollections(collections)

    const events = await collections.events.find({}).toArray()
    expect(events).toHaveLength(0)

    const messages = await collections.messages.find({}).toArray()
    expect(messages).toHaveLength(0)
  })

  afterAll(async () => {
    await closeMongoDbConnection()
  })

  test('should process a successful message stream scenario', async () => {
    await processScenarioEvents(getScenario('streams.successful'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(3)

    const savedMessages = await collections.messages.find({}).toArray()
    expect(savedMessages).toHaveLength(1)
    expect(savedMessages[0].events.length).toBe(3)
  })

  test('should process a validation failure scenario', async () => {
    await processScenarioEvents(getScenario('streams.validationFailure'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(2)

    const savedMessages = await collections.messages.find({}).toArray()
    expect(savedMessages).toHaveLength(1)
    expect(savedMessages[0].events.length).toBe(2)
  })

  test('should process a provider failure scenario', async () => {
    await processScenarioEvents(getScenario('streams.providerFailure'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(3)

    const savedMessages = await collections.messages.find({}).toArray()
    expect(savedMessages).toHaveLength(1)
    expect(savedMessages[0].events.length).toBe(3)
  })

  test('should process an internal failure scenario', async () => {
    await processScenarioEvents(getScenario('streams.internalFailure'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(2)

    const savedMessages = await collections.messages.find({}).toArray()
    expect(savedMessages).toHaveLength(1)
    expect(savedMessages[0].events.length).toBe(2)
  })

  test('should process a retry success scenario', async () => {
    await processScenarioEvents(getScenario('streams.retrySuccess'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(5)

    const savedMessages = await collections.messages.find({}).toArray()
    expect(savedMessages).toHaveLength(1)
    expect(savedMessages[0].events.length).toBe(5)
  })

  test('should process a retry failure scenario', async () => {
    await processScenarioEvents(getScenario('streams.retryFailure'))

    const savedEvents = await collections.events.find({}).toArray()

    expect(savedEvents.length).toBe(5)

    const savedMessages = await collections.messages.find({}).toArray()
    expect(savedMessages).toHaveLength(1)
    expect(savedMessages[0].events.length).toBe(5)
  })
})
