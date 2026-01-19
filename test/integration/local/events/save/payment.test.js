import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../../src/config/config.js'
import { paymentProcessed, paymentSubmitted, paymentExtracted } from '../../../../mocks/events.js'
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
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].invoiceNumber).toBe(event.data.invoiceNumber)
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

    // Create a second event with the same correlationId but same invoiceNumber
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
    expect(updatedPayment.paymentRequests).toHaveLength(1)
    expect(updatedPayment.paymentRequests[0].invoiceNumber).toBe(event.data.invoiceNumber)
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
    expect(updatedPayment.paymentRequests).toHaveLength(1)
    expect(updatedPayment.paymentRequests[0].invoiceNumber).toBe(event.data.invoiceNumber)
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
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].trader).toBe(event.data.trader)
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
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].vendor).toBe(event.data.vendor)
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
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].trader).toBe(event.data.trader)
    expect(savedPayment.paymentRequests[0].vendor).toBe(event.data.vendor)
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

    // Create a newer event with different property values and different invoice number
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

    // Newer event should update top-level properties
    expect(updatedPayment.frn).toBe(2222222222)
    expect(updatedPayment.sbi).toBe(222222222)
    expect(updatedPayment.schemeId).toBe(2)
    expect(updatedPayment.status).toBe('submitted')
    expect(updatedPayment.events).toHaveLength(2)
    // Both invoices should exist in paymentRequests array
    expect(updatedPayment.paymentRequests).toHaveLength(2)
    expect(updatedPayment.paymentRequests[0].invoiceNumber).toBe('INV-2025-100')
    expect(updatedPayment.paymentRequests[1].invoiceNumber).toBe('INV-2025-101')
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

    // Create an older event with different property values and different invoice number
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
    // Older event should NOT update top-level properties - original values should remain
    expect(payment.frn).toBe(3333333333)
    expect(payment.sbi).toBe(333333333)
    expect(payment.schemeId).toBe(3)
    expect(payment.status).toBe('submitted')
    expect(payment.events).toHaveLength(2)
    // Both invoices should exist in paymentRequests array since they have different invoice numbers
    expect(payment.paymentRequests).toHaveLength(2)
    expect(payment.paymentRequests[0].invoiceNumber).toBe('INV-2025-200')
    expect(payment.paymentRequests[1].invoiceNumber).toBe('INV-2025-201')
  })

  test('should convert value to pence for payment.extracted event', async () => {
    const event = paymentExtracted

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].value).toBe(8000000)
  })

  test('should convert invoice line values to pence for payment.extracted event', async () => {
    const event = paymentExtracted

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].invoiceLines).toBeDefined()
    expect(savedPayment.paymentRequests[0].invoiceLines).toHaveLength(2)
    expect(savedPayment.paymentRequests[0].invoiceLines[0].value).toBe(10000000)
    expect(savedPayment.paymentRequests[0].invoiceLines[0].description).toBe('G00 - Gross value of payment')
    expect(savedPayment.paymentRequests[0].invoiceLines[1].value).toBe(-2000000)
    expect(savedPayment.paymentRequests[0].invoiceLines[1].description).toBe('P24 - Penalty')
  })

  test('should not convert values for non-extracted payment events', async () => {
    const event = {
      ...paymentProcessed,
      data: {
        ...paymentProcessed.data,
        correlationId: '99389915-7275-457a-b8ca-8bf206b2e67c',
        value: 125.50,
        invoiceLines: [
          {
            description: 'Line 1',
            value: 75.25
          }
        ]
      }
    }

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].value).toBe(125.50)
    expect(savedPayment.paymentRequests[0].invoiceLines[0].value).toBe(75.25)
  })

  test('should handle payment.extracted event with value but no invoice lines', async () => {
    const event = {
      ...paymentExtracted,
      data: {
        correlationId: '88389915-7275-457a-b8ca-8bf206b2e67c',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-006',
        value: 100.00
      }
    }

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].value).toBe(10000) // 100.00 in pounds = 10000 pence
    expect(savedPayment.paymentRequests[0].invoiceLines).toBeUndefined()
  })

  test('should handle payment.extracted event with invoice lines but no main value', async () => {
    const event = {
      ...paymentExtracted,
      data: {
        correlationId: '77389915-7275-457a-b8ca-8bf206b2e67c',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-007',
        invoiceLines: [
          {
            description: 'Line 1',
            value: 25.50
          }
        ]
      }
    }

    await save(event)

    const savedPayment = await collections.payments.findOne({ _id: event.data.correlationId })

    expect(savedPayment).toBeDefined()
    expect(savedPayment.paymentRequests).toHaveLength(1)
    expect(savedPayment.paymentRequests[0].value).toBeUndefined()
    expect(savedPayment.paymentRequests[0].invoiceLines[0].value).toBe(2550)
  })

  test('should update existing payment request when same invoiceNumber comes with newer event', async () => {
    const initialEvent = {
      id: '850e8400-e29b-41d4-a716-446655440300',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.processed',
      datacontenttype: 'application/json',
      time: '2023-10-17T14:00:00.000Z',
      data: {
        correlationId: '79389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-300',
        value: 100
      }
    }

    await save(initialEvent)

    // Create a newer event with same invoice number but updated value
    const newerEvent = {
      id: '850e8400-e29b-41d4-a716-446655440301',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.submitted',
      datacontenttype: 'application/json',
      time: '2023-10-17T15:00:00.000Z',
      data: {
        correlationId: '79389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-300',
        value: 200
      }
    }

    await save(newerEvent)

    const updatedPayment = await collections.payments.findOne({ _id: initialEvent.data.correlationId })

    expect(updatedPayment).toBeDefined()
    // Should still have only 1 payment request since invoice numbers are the same
    expect(updatedPayment.paymentRequests).toHaveLength(1)
    expect(updatedPayment.paymentRequests[0].invoiceNumber).toBe('INV-2025-300')
    // Value should be updated to the newer value
    expect(updatedPayment.paymentRequests[0].value).toBe(200)
    expect(updatedPayment.status).toBe('submitted')
  })

  test('should not update existing payment request when same invoiceNumber comes with older event', async () => {
    const initialEvent = {
      id: '850e8400-e29b-41d4-a716-446655440400',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.submitted',
      datacontenttype: 'application/json',
      time: '2023-10-17T15:00:00.000Z',
      data: {
        correlationId: '89389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-400',
        value: 200
      }
    }

    await save(initialEvent)

    // Create an older event with same invoice number but different value
    const olderEvent = {
      id: '850e8400-e29b-41d4-a716-446655440401',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.processed',
      datacontenttype: 'application/json',
      time: '2023-10-17T14:00:00.000Z',
      data: {
        correlationId: '89389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-400',
        value: 100
      }
    }

    await save(olderEvent)

    const payment = await collections.payments.findOne({ _id: initialEvent.data.correlationId })

    expect(payment).toBeDefined()
    // Should still have only 1 payment request
    expect(payment.paymentRequests).toHaveLength(1)
    expect(payment.paymentRequests[0].invoiceNumber).toBe('INV-2025-400')
    // Value should NOT be updated - should remain as the newer value
    expect(payment.paymentRequests[0].value).toBe(200)
  })

  test('should handle multiple payment requests with different invoice numbers', async () => {
    const event1 = {
      id: '850e8400-e29b-41d4-a716-446655440500',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.processed',
      datacontenttype: 'application/json',
      time: '2023-10-17T14:00:00.000Z',
      data: {
        correlationId: '99389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-500',
        value: 100
      }
    }

    await save(event1)

    const event2 = {
      id: '850e8400-e29b-41d4-a716-446655440501',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.processed',
      datacontenttype: 'application/json',
      time: '2023-10-17T14:05:00.000Z',
      data: {
        correlationId: '99389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-501',
        value: 200
      }
    }

    await save(event2)

    const event3 = {
      id: '850e8400-e29b-41d4-a716-446655440502',
      source: 'ffc-pay-processing',
      specversion: '1.0',
      type: 'uk.gov.defra.ffc.pay.payment.processed',
      datacontenttype: 'application/json',
      time: '2023-10-17T14:10:00.000Z',
      data: {
        correlationId: '99389915-7275-457a-b8ca-8bf206b2e67b',
        frn: 1234567890,
        sbi: 123456789,
        schemeId: 1,
        invoiceNumber: 'INV-2025-502',
        value: 300
      }
    }

    await save(event3)

    const payment = await collections.payments.findOne({ _id: event1.data.correlationId })

    expect(payment).toBeDefined()
    expect(payment.paymentRequests).toHaveLength(3)
    expect(payment.paymentRequests[0].invoiceNumber).toBe('INV-2025-500')
    expect(payment.paymentRequests[0].value).toBe(100)
    expect(payment.paymentRequests[1].invoiceNumber).toBe('INV-2025-501')
    expect(payment.paymentRequests[1].value).toBe(200)
    expect(payment.paymentRequests[2].invoiceNumber).toBe('INV-2025-502')
    expect(payment.paymentRequests[2].value).toBe(300)
  })
})
