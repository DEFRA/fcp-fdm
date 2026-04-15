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

  test('should process a payment extracted scenario', async () => {
    await processScenarioEvents(getScenario('single.paymentExtracted'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(1)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(1)
    expect(savedPayments[0].paymentRequests).toHaveLength(1)
    expect(savedPayments[0].paymentRequests[0].invoiceNumber).toBe('SFI0001234V001')
  })

  test('should process a payment enriched scenario', async () => {
    await processScenarioEvents(getScenario('single.paymentEnriched'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(1)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(1)
    expect(savedPayments[0].paymentRequests).toHaveLength(1)
    expect(savedPayments[0].paymentRequests[0].invoiceNumber).toBe('S000000010000001V001')
  })

  test('should process a payment processed scenario', async () => {
    await processScenarioEvents(getScenario('single.paymentProcessed'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(1)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(1)
    expect(savedPayments[0].paymentRequests).toHaveLength(1)
    expect(savedPayments[0].paymentRequests[0].invoiceNumber).toBe('S000000010000001V001')
  })

  test('should process a payment submitted scenario', async () => {
    await processScenarioEvents(getScenario('single.paymentSubmitted'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(1)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(1)
    expect(savedPayments[0].paymentRequests).toHaveLength(1)
    expect(savedPayments[0].paymentRequests[0].invoiceNumber).toBe('S000000010000001V001')
  })

  test('should process a payment acknowledged scenario', async () => {
    await processScenarioEvents(getScenario('single.paymentAcknowledged'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(1)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(1)
    expect(savedPayments[0].paymentRequests).toHaveLength(1)
    expect(savedPayments[0].paymentRequests[0].invoiceNumber).toBe('S000000010000001V001')
  })

  test('should process full payment transaction with all events', async () => {
    await processScenarioEvents(getScenario('streams.paymentFullTransaction'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(5)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(5)
    expect(savedPayments[0].frn).toBe(1234567890)
    expect(savedPayments[0].sbi).toBe(123456789)
    expect(savedPayments[0].schemeId).toBe(1)
    expect(savedPayments[0].paymentRequests).toHaveLength(1)
    expect(savedPayments[0].paymentRequests[0].invoiceNumber).toBe('S000000010000001V001')
    expect(savedPayments[0].paymentRequests[0].value).toBe(80000)
    expect(savedPayments[0].paymentRequests[0].invoiceLines).toHaveLength(2)
    expect(savedPayments[0].paymentRequests[0].invoiceLines[0].description).toBe('G00 - Gross value of payment')
    expect(savedPayments[0].paymentRequests[0].invoiceLines[0].value).toBe(100000)
    expect(savedPayments[0].paymentRequests[0].invoiceLines[1].description).toBe('P24 - Penalty')
    expect(savedPayments[0].paymentRequests[0].invoiceLines[1].value).toBe(-20000)
  })

  test('should not regress payment status when a duplicate enriched event is received', async () => {
    await processScenarioEvents(getScenario('streams.paymentDuplicateEnriched'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(6)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    // Duplicate enriched is in the audit trail
    expect(savedPayments[0].events.length).toBe(6)
    // Status must not have regressed back to 'enriched'
    expect(savedPayments[0].status).toBe('acknowledged')
    // lastEventTime must reflect the acknowledged event, not the duplicate
    expect(savedPayments[0].lastEventTime).toEqual(new Date('2023-10-17T14:49:01.000Z'))
    // paymentRequests array must remain unchanged — no duplicate entry added
    expect(savedPayments[0].paymentRequests).toHaveLength(1)
    expect(savedPayments[0].paymentRequests[0].invoiceNumber).toBe('S000000010000001V001')
    // lastUpdated on the paymentRequest must not have advanced to the duplicate's time
    expect(savedPayments[0].paymentRequests[0].lastUpdated).not.toEqual(new Date('2023-10-17T14:50:01.000Z'))
  })

  test('should replace paymentRequests array when previous status was extracted and incoming event is newer', async () => {
    await processScenarioEvents(getScenario('streams.paymentExtractedThenEnriched'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(2)

    const savedPayments = await collections.payments.find({}).toArray()
    expect(savedPayments).toHaveLength(1)
    expect(savedPayments[0].events.length).toBe(2)
    // The raw invoice number from the extracted event should have been replaced,
    // not appended to, leaving only the enriched event's invoice number
    expect(savedPayments[0].paymentRequests).toHaveLength(1)
    expect(savedPayments[0].paymentRequests[0].invoiceNumber).toBe('S000000010000001V001')
    expect(savedPayments[0].paymentRequests[0].value).toBe(80000)
  })
})
