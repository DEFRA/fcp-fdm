import { describe, test, expect } from 'vitest'

import { getEventType, eventTypes } from '../../../src/events/types'

const {
  MESSAGE_EVENT,
  MESSAGE_EVENT_REJECTED,
  DOCUMENT_EVENT,
  CRM_EVENT,
  PAYMENT_EVENT
} = eventTypes

describe('getEventType', () => {
  test('should return message rejected event type for validation failure events', () => {
    const eventType = getEventType('uk.gov.fcp.sfd.notification.failure.validation')
    expect(eventType).toBe(MESSAGE_EVENT_REJECTED)
  })

  test('should return message event type if event relates to Single Front Door Comms', () => {
    const eventType = getEventType('uk.gov.fcp.sfd.notification.event')
    expect(eventType).toBe(MESSAGE_EVENT)
  })

  test('should return document event type if event relates to Single Front Door Document Upload events', () => {
    const eventType = getEventType('uk.gov.fcp.sfd.document.event')
    expect(eventType).toBe(DOCUMENT_EVENT)
  })

  test('should return crm event type if event relates to Single Front Door CRM events', () => {
    const eventType = getEventType('uk.gov.fcp.sfd.crm.event')
    expect(eventType).toBe(CRM_EVENT)
  })

  test('should return payment event type if event relates to Payment Hub payments', () => {
    const eventType = getEventType('uk.gov.defra.ffc.pay.payment.event')
    expect(eventType).toBe(PAYMENT_EVENT)
  })

  test('should throw error for unknown event types', () => {
    expect(() => getEventType('unknown.event.type')).toThrow('Unknown event type: unknown.event.type')
  })
})
