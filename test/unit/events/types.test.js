import { describe, test, expect } from 'vitest'

import { getEventType, eventTypes } from '../../../src/events/types'

const { MESSAGE_EVENT } = eventTypes

describe('getEventType', () => {
  test('should return correct message event type if event relates to Single Front Door Comms', () => {
    const eventType = getEventType('uk.gov.fcp.sfd.notification.event')
    expect(eventType).toBe(MESSAGE_EVENT)
  })

  test('should throw error for unknown event types', () => {
    expect(() => getEventType('unknown.event.type')).toThrow('Unknown event type: unknown.event.type')
  })
})
