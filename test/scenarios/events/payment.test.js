import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../src/common/helpers/mongodb.js'
import { config } from '../../../src/config/config.js'
import { clearAllCollections } from '../../helpers/mongo.js'
import { getScenario } from '../scenarios.js'
import { processScenarioEvents } from '../../helpers/scenarios.js'

let collections

describe('payment event scenarios', () => {
  beforeAll(async () => {
    await createMongoDbConnection(config.get('mongo'))

    const mongoDb = getMongoDb()
    collections = mongoDb.collections
  })

  beforeEach(async () => {
    await clearAllCollections(collections)

    const events = await collections.events.find({}).toArray()
    expect(events).toHaveLength(0)

    const payments = await collections.payments.find({}).toArray()
    expect(payments).toHaveLength(0)
  })

  afterAll(async () => {
    await closeMongoDbConnection()
  })

  test('should process a payment processed scenario', async () => {
    await processScenarioEvents(getScenario('single.paymentProcessed'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(1)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(1)
    expect(savedPayments[0].invoiceNumber).toBe('INV-2025-001')
  })

  test('should process multiple payment events for same correlation', async () => {
    await processScenarioEvents(getScenario('streams.paymentProcessedAndSubmitted'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(2)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(2)
  })
})
