import { vi, describe, test, expect } from 'vitest'

vi.mock('../../../../src/common/helpers/logging/logger.js')

const { getEventSummary, getStatusFromTypeSuffix } = await import('../../../../src/events/save/cloud-events.js')

describe('getEventSummary', () => {
  test('should return summary with all required fields', () => {
    const event = {
      _id: 'fcp-sfd-test:550e8400-e29b-41d4-a716-446655440001',
      id: '550e8400-e29b-41d4-a716-446655440001',
      source: 'fcp-sfd-test',
      type: 'uk.gov.fcp.sfd.test.created',
      time: '2023-10-17T14:48:01.000Z',
      subject: 'test-subject',
      received: new Date('2023-10-17T14:48:02.000Z'),
      specversion: '1.0',
      datacontenttype: 'application/json',
      data: { testData: 'value' }
    }

    const summary = getEventSummary(event)

    expect(summary).toEqual({
      _id: 'fcp-sfd-test:550e8400-e29b-41d4-a716-446655440001',
      type: 'uk.gov.fcp.sfd.test.created',
      source: 'fcp-sfd-test',
      id: '550e8400-e29b-41d4-a716-446655440001',
      time: '2023-10-17T14:48:01.000Z',
      subject: 'test-subject',
      received: new Date('2023-10-17T14:48:02.000Z')
    })
  })

  test('should exclude data field from summary', () => {
    const event = {
      _id: 'fcp-sfd-test:550e8400-e29b-41d4-a716-446655440001',
      id: '550e8400-e29b-41d4-a716-446655440001',
      source: 'fcp-sfd-test',
      type: 'uk.gov.fcp.sfd.test.created',
      time: '2023-10-17T14:48:01.000Z',
      subject: 'test-subject',
      received: new Date('2023-10-17T14:48:02.000Z'),
      data: { sensitiveData: 'should not be in summary' }
    }

    const summary = getEventSummary(event)

    expect(summary.data).toBeUndefined()
    expect(summary).not.toHaveProperty('data')
  })

  test('should exclude specversion field from summary', () => {
    const event = {
      _id: 'fcp-sfd-test:550e8400-e29b-41d4-a716-446655440001',
      id: '550e8400-e29b-41d4-a716-446655440001',
      source: 'fcp-sfd-test',
      type: 'uk.gov.fcp.sfd.test.created',
      time: '2023-10-17T14:48:01.000Z',
      subject: 'test-subject',
      received: new Date('2023-10-17T14:48:02.000Z'),
      specversion: '1.0'
    }

    const summary = getEventSummary(event)

    expect(summary.specversion).toBeUndefined()
    expect(summary).not.toHaveProperty('specversion')
  })

  test('should exclude datacontenttype field from summary', () => {
    const event = {
      _id: 'fcp-sfd-test:550e8400-e29b-41d4-a716-446655440001',
      id: '550e8400-e29b-41d4-a716-446655440001',
      source: 'fcp-sfd-test',
      type: 'uk.gov.fcp.sfd.test.created',
      time: '2023-10-17T14:48:01.000Z',
      subject: 'test-subject',
      received: new Date('2023-10-17T14:48:02.000Z'),
      datacontenttype: 'application/json'
    }

    const summary = getEventSummary(event)

    expect(summary.datacontenttype).toBeUndefined()
    expect(summary).not.toHaveProperty('datacontenttype')
  })

  test('should handle event with undefined subject', () => {
    const event = {
      _id: 'fcp-sfd-test:550e8400-e29b-41d4-a716-446655440001',
      id: '550e8400-e29b-41d4-a716-446655440001',
      source: 'fcp-sfd-test',
      type: 'uk.gov.fcp.sfd.test.created',
      time: '2023-10-17T14:48:01.000Z',
      received: new Date('2023-10-17T14:48:02.000Z'),
      subject: undefined
    }

    const summary = getEventSummary(event)

    expect(summary.subject).toBeUndefined()
    expect(summary).toHaveProperty('subject')
  })

  test('should preserve exact field values without transformation', () => {
    const receivedDate = new Date('2023-10-17T14:48:02.123Z')
    const event = {
      _id: 'fcp-sfd-test:550e8400-e29b-41d4-a716-446655440001',
      id: '550e8400-e29b-41d4-a716-446655440001',
      source: 'fcp-sfd-test',
      type: 'uk.gov.fcp.sfd.test.created',
      time: '2023-10-17T14:48:01.456Z',
      subject: 'test-subject-123',
      received: receivedDate
    }

    const summary = getEventSummary(event)

    expect(summary._id).toBe(event._id)
    expect(summary.id).toBe(event.id)
    expect(summary.source).toBe(event.source)
    expect(summary.type).toBe(event.type)
    expect(summary.time).toBe(event.time)
    expect(summary.subject).toBe(event.subject)
    expect(summary.received).toBe(receivedDate)
  })
})

describe('getStatusFromTypeSuffix', () => {
  test('should extract status when eventType starts with prefix', () => {
    const eventType = 'uk.gov.fcp.sfd.notification.delivered'
    const prefix = 'uk.gov.fcp.sfd.notification.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBe('delivered')
  })

  test('should return null when eventType does not start with prefix', () => {
    const eventType = 'uk.gov.fcp.sfd.document.uploaded'
    const prefix = 'uk.gov.fcp.sfd.notification.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBeNull()
  })

  test('should extract multi-word status', () => {
    const eventType = 'uk.gov.fcp.sfd.notification.failure.validation'
    const prefix = 'uk.gov.fcp.sfd.notification.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBe('failure.validation')
  })

  test('should extract empty string when eventType equals prefix', () => {
    const eventType = 'uk.gov.fcp.sfd.notification.'
    const prefix = 'uk.gov.fcp.sfd.notification.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBe('')
  })

  test('should be case-sensitive', () => {
    const eventType = 'uk.gov.fcp.sfd.notification.Delivered'
    const prefix = 'uk.gov.fcp.sfd.notification.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBe('Delivered')
  })

  test('should handle eventType with partial prefix match', () => {
    const eventType = 'uk.gov.fcp.sfd.notificatio.delivered'
    const prefix = 'uk.gov.fcp.sfd.notification.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBeNull()
  })

  test('should extract status for document events', () => {
    const eventType = 'uk.gov.fcp.sfd.document.uploaded'
    const prefix = 'uk.gov.fcp.sfd.document.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBe('uploaded')
  })

  test('should extract status for crm events', () => {
    const eventType = 'uk.gov.fcp.sfd.crm.created'
    const prefix = 'uk.gov.fcp.sfd.crm.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBe('created')
  })

  test('should return null for empty eventType', () => {
    const eventType = ''
    const prefix = 'uk.gov.fcp.sfd.notification.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBeNull()
  })

  test('should return null when prefix is longer than eventType', () => {
    const eventType = 'short'
    const prefix = 'very.long.prefix.that.is.longer.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBeNull()
  })

  test('should handle single character status', () => {
    const eventType = 'prefix.a'
    const prefix = 'prefix.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBe('a')
  })

  test('should extract status with special characters', () => {
    const eventType = 'uk.gov.fcp.sfd.notification.failure-retry_001'
    const prefix = 'uk.gov.fcp.sfd.notification.'

    const status = getStatusFromTypeSuffix(eventType, prefix)

    expect(status).toBe('failure-retry_001')
  })
})
