import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../../src/config/config.js'
import { paymentProcessed, paymentSubmitted } from '../../../../mocks/events.js'
import { save } from '../../../../../src/events/save/payment.js'
import { clearAllCollections } from '../../../../helpers/mongo.js'
import { eventTypePrefixes } from '../../../../../src/events/types.js'

const { PAYMENT_EVENT_PREFIX } = eventTypePrefixes

const paymentEvents = {
  paymentProcessed,
  paymentSubmitted
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

  test.for(Object.keys(paymentEvents))('should save event to event collection for %s with composite _id', async (eventName) => {
    const event = paymentEvents[eventName]

    await save(event)

    const savedEvent = await collections.events.findOne({ _id: `${event.source}:${event.id}` })

    expect(savedEvent).toBeDefined()
    expect(savedEvent.id).toBe(event.id)
  })

  test.for(Object.keys(paymentEvents))('should save new event aggregation document for %s if first event for correlationId', async (eventName) => {
    const event = paymentEvents[eventName]

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.correlationId).toBe(event.data.correlationId)
    expect(savedPayment.frn).toBe(event.data.frn)
    expect(savedPayment.sbi).toBe(event.data.sbi)
    expect(savedPayment.schemeId).toBe(event.data.schemeId)
    expect(savedPayment.invoiceNumber).toBe(event.data.invoiceNumber)
    expect(savedPayment.events).toHaveLength(1)
    expect(savedPayment.events[0]._id).toBe(`${event.source}:${event.id}`)
  })

  test.for(Object.keys(paymentEvents))('should save status for new event aggregation document for %s if first event for correlationId', async (eventName) => {
    const event = paymentEvents[eventName]
    const expectedStatus = paymentEvents[eventName].type.replace(`${PAYMENT_EVENT_PREFIX}`, '')

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.status).toBe(expectedStatus)
  })

  test.for(Object.keys(paymentEvents))('should update existing event aggregation document for %s if subsequent event for correlationId', async (eventName) => {
    const event = paymentEvents[eventName]
    // Save first event
    await save(event)

    // Create a second event with the same correlationId
    const secondEvent = {
      ...event,
      id: `${event.id}-second`,
      type: `${event.type}-2`,
      time: new Date(new Date(event.time).getTime() + 1000).toISOString()
    }

    await save(secondEvent)

    const expectedStatus = secondEvent.type.replace(`${PAYMENT_EVENT_PREFIX}`, '')

    const updatedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(updatedPayment).toBeDefined()
    expect(updatedPayment.correlationId).toBe(event.data.correlationId)
    expect(updatedPayment.frn).toBe(event.data.frn)
    expect(updatedPayment.sbi).toBe(event.data.sbi)
    expect(updatedPayment.schemeId).toBe(event.data.schemeId)
    expect(updatedPayment.invoiceNumber).toBe(event.data.invoiceNumber)
    expect(updatedPayment.events).toHaveLength(2)
    expect(updatedPayment.events[1]._id).toBe(`${secondEvent.source}:${secondEvent.id}`)
    expect(updatedPayment.status).toBe(expectedStatus)
  })

  test.for(Object.keys(paymentEvents))('should not update existing payment status for %s if subsequent event for correlationId if later event exists', async (eventName) => {
    const event = paymentEvents[eventName]
    // Save first event
    await save(event)

    // Create a second event with the same correlationId but earlier time
    const secondEvent = {
      ...event,
      id: `${event.id}-second`,
      time: new Date(new Date(event.time).getTime() - 1000).toISOString()
    }

    await save(secondEvent)

    const expectedStatus = event.type.replace(`${PAYMENT_EVENT_PREFIX}`, '')

    const updatedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(updatedPayment).toBeDefined()
    expect(updatedPayment.correlationId).toBe(event.data.correlationId)
    expect(updatedPayment.frn).toBe(event.data.frn)
    expect(updatedPayment.sbi).toBe(event.data.sbi)
    expect(updatedPayment.schemeId).toBe(event.data.schemeId)
    expect(updatedPayment.invoiceNumber).toBe(event.data.invoiceNumber)
    expect(updatedPayment.events).toHaveLength(2)
    expect(updatedPayment.events[1]._id).toBe(`${secondEvent.source}:${secondEvent.id}`)
    expect(updatedPayment.status).toBe(expectedStatus)
  })

  test.for(Object.keys(paymentEvents))('should not update event or payment collections if duplicate %s event', async (eventName) => {
    const event = paymentEvents[eventName]
    // Save first event
    await save(event)

    // Attempt to save duplicate event
    await save(event)

    const eventsCount = await collections.events.countDocuments({ _id: `${event.source}:${event.id}` })
    expect(eventsCount).toBe(1)

    const paymentsCount = await collections.payments.countDocuments({ _id: event.data.correlationId })
    expect(paymentsCount).toBe(1)
  })

  test('should save payment with trader identifier', async () => {
    const event = {
      ...paymentProcessed,
      data: {
        correlationId: '29389915-7275-457a-b8ca-8bf206b2e67b',
        trader: 'TRADER123',
        schemeId: 1,
        invoiceNumber: 'INV-2025-002'
      }
    }

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.trader).toBe(event.data.trader)
    expect(savedPayment.frn).toBeUndefined()
    expect(savedPayment.sbi).toBeUndefined()
  })

  test('should save payment with vendor identifier', async () => {
    const event = {
      ...paymentProcessed,
      data: {
        correlationId: '39389915-7275-457a-b8ca-8bf206b2e67b',
        vendor: 'VENDOR456',
        schemeId: 1,
        invoiceNumber: 'INV-2025-003'
      }
    }

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.vendor).toBe(event.data.vendor)
    expect(savedPayment.frn).toBeUndefined()
    expect(savedPayment.sbi).toBeUndefined()
  })

  test('should save payment with all customer identifiers', async () => {
    const event = {
      ...paymentProcessed,
      data: {
        correlationId: '49389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1234567890,
        sbi: 123456789,
        trader: 'TRADER123',
        vendor: 'VENDOR456',
        schemeId: 1,
        invoiceNumber: 'INV-2025-004'
      }
    }

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.frn).toBe(event.data.frn)
    expect(savedPayment.sbi).toBe(event.data.sbi)
    expect(savedPayment.trader).toBe(event.data.trader)
    expect(savedPayment.vendor).toBe(event.data.vendor)
  })

  test('should update payment properties with newer event', async () => {
    const initialEvent = {
      id: '850e8400-e29b-41d4-a716-446655440100',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.processed',
      datacontenttype: 'application/json',
      time: '2023-10-17T14:00:00.000Z',
      data: {
        correlationId: '59389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1111111111,
        sbi: 111111111,
        schemeId: 1,
        invoiceNumber: 'INV-2025-100'
      }
    }

    await save(initialEvent)

    // Create a newer event with different property values
    const newerEvent = {
      id: '850e8400-e29b-41d4-a716-446655440101',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.submitted',
      datacontenttype: 'application/json',
      time: '2023-10-17T15:00:00.000Z',
      data: {
        correlationId: '59389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 2222222222,
        sbi: 222222222,
        schemeId: 2,
        invoiceNumber: 'INV-2025-101'
      }
    }

    await save(newerEvent)

    const updatedPayment = await collections.payments.findOne({ _id: initialEvent.data.correlationId })

    // Newer event should update all properties
    expect(updatedPayment.frn).toBe(2222222222)
    expect(updatedPayment.sbi).toBe(222222222)
    expect(updatedPayment.schemeId).toBe(2)
    expect(updatedPayment.invoiceNumber).toBe('INV-2025-101')
    expect(updatedPayment.status).toBe('submitted')
    expect(updatedPayment.events).toHaveLength(2)
  })

  test('should not update payment properties with older event', async () => {
    const initialEvent = {
      id: '850e8400-e29b-41d4-a716-446655440200',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.submitted',
      datacontenttype: 'application/json',
      time: '2023-10-17T15:00:00.000Z',
      data: {
        correlationId: '69389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 3333333333,
        sbi: 333333333,
        schemeId: 3,
        invoiceNumber: 'INV-2025-200'
      }
    }

    await save(initialEvent)

    // Verify first event was saved correctly
    let payment = await collections.payments.findOne({ _id: initialEvent.data.correlationId })
    expect(payment.status).toBe('submitted')
    expect(payment.frn).toBe(3333333333)
    expect(payment.lastEventTime).toEqual(new Date('2023-10-17T15:00:00.000Z'))

    // Create an older event with different property values
    const olderEvent = {
      id: '850e8400-e29b-41d4-a716-446655440201',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.processed',
      datacontenttype: 'application/json',
      time: '2023-10-17T14:00:00.000Z',
      data: {
        correlationId: '69389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 4444444444,
        sbi: 444444444,
        schemeId: 4,
        invoiceNumber: 'INV-2025-201'
      }
    }

    await save(olderEvent)

    payment = await collections.payments.findOne({ _id: initialEvent.data.correlationId })

    // lastEventTime should still be the newer event's time
    expect(payment.lastEventTime).toEqual(new Date('2023-10-17T15:00:00.000Z'))
    // Older event should NOT update properties - original values should remain
    expect(payment.frn).toBe(3333333333)
    expect(payment.sbi).toBe(333333333)
    expect(payment.schemeId).toBe(3)
    expect(payment.invoiceNumber).toBe('INV-2025-200')
    expect(payment.status).toBe('submitted')
    expect(payment.events).toHaveLength(2)
  })
})
