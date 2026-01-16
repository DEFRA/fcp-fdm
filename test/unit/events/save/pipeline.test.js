import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('../../../../src/events/save/cloud-events.js', () => ({
  getEventSummary: vi.fn(),
  getStatusFromTypeSuffix: vi.fn()
}))

const { getEventSummary, getStatusFromTypeSuffix } = await import('../../../../src/events/save/cloud-events.js')
const { buildSavePipeline } = await import('../../../../src/events/save/pipeline.js')

describe('buildSavePipeline', () => {
  const mockEvent = {
    type: 'uk.gov.fcp.sfd.test.created',
    time: '2024-01-15T10:00:00.000Z',
    data: {
      correlationId: 'test-correlation-id',
      testField: 'test-value'
    }
  }

  const mockEventEntity = {
    _id: 'source:event-id',
    type: 'uk.gov.fcp.sfd.test.created',
    source: 'source',
    id: 'event-id',
    time: '2024-01-15T10:00:00.000Z',
    subject: 'test-subject',
    received: new Date('2024-01-15T10:00:01.000Z')
  }

  const mockEventSummary = {
    _id: 'source:event-id',
    type: 'uk.gov.fcp.sfd.test.created',
    source: 'source',
    id: 'event-id',
    time: '2024-01-15T10:00:00.000Z',
    subject: 'test-subject',
    received: new Date('2024-01-15T10:00:01.000Z')
  }

  beforeEach(() => {
    vi.resetAllMocks()
    getEventSummary.mockReturnValue(mockEventSummary)
    getStatusFromTypeSuffix.mockReturnValue('created')
  })

  test('should build complete 5-stage MongoDB aggregation pipeline', () => {
    const mappings = {
      dataFields: { testField: 'test-value' },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline).toHaveLength(5)
    expect(pipeline[0]).toHaveProperty('$set') // Stage 1: Set data
    expect(pipeline[1]).toHaveProperty('$set') // Stage 2: Events array
    expect(pipeline[2]).toHaveProperty('$set') // Stage 3a: Capture _prevLastEventTime
    expect(pipeline[3]).toHaveProperty('$set') // Stage 3b: Update lastEventTime and status
    expect(pipeline[4]).toHaveProperty('$unset') // Stage 4: Cleanup
  })

  test('should set incoming time from event.time in stage 1', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[0].$set._incomingTime).toEqual(new Date('2024-01-15T10:00:00.000Z'))
  })

  test('should set lastUpdated to eventEntity.received in stage 1', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[0].$set.lastUpdated).toEqual(mockEventEntity.received)
  })

  test('should set created timestamp only on first upsert using $ifNull', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[0].$set.created).toEqual({
      $ifNull: ['$created', mockEventEntity.received]
    })
  })

  test('should spread dataFields in stage 1', () => {
    const mappings = {
      dataFields: {
        correlationId: 'test-id',
        customField: 'custom-value'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[0].$set.correlationId).toBe('test-id')
    expect(pipeline[0].$set.customField).toBe('custom-value')
  })

  test('should call getEventSummary with eventEntity', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(getEventSummary).toHaveBeenCalledWith(mockEventEntity)
    expect(getEventSummary).toHaveBeenCalledTimes(1)
  })

  test('should append event to array only if not already present', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[1].$set.events).toHaveProperty('$cond')
    expect(pipeline[1].$set.events.$cond.else).toEqual({
      $concatArrays: [{ $ifNull: ['$events', []] }, [mockEventSummary]]
    })
  })

  test('should check for duplicate event using eventEntity._id in stage 2', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[1].$set.events.$cond.if).toEqual({
      $in: [mockEventEntity._id, { $ifNull: [{ $map: { input: '$events', as: 'e', in: '$$e._id' } }, []] }]
    })
  })

  test('should call getStatusFromTypeSuffix with event.type and prefix', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(getStatusFromTypeSuffix).toHaveBeenCalledWith(mockEvent.type, 'uk.gov.fcp.sfd.test.')
    expect(getStatusFromTypeSuffix).toHaveBeenCalledTimes(1)
  })

  test('should update status only when incoming event is chronologically newer', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[3].$set.status).toHaveProperty('$cond')
    expect(pipeline[3].$set.status.$cond[0]).toEqual({
      $gt: ['$_incomingTime', '$_prevLastEventTime']
    })
    expect(pipeline[3].$set.status.$cond[1]).toBe('created')
    expect(pipeline[3].$set.status.$cond[2]).toBe('$status')
  })

  test('should track most recent event time using $max to handle out-of-order events', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[3].$set.lastEventTime).toEqual({
      $max: ['$lastEventTime', '$_incomingTime']
    })
  })

  test('should clean up temporary fields used for pipeline calculations', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[4].$unset).toContain('_incomingTime')
    expect(pipeline[4].$unset).toContain('_prevLastEventTime')
  })

  test('should unset additional fields specified in unsetFields', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      unsetFields: ['_customTemp', '_anotherTemp']
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[4].$unset).toContain('_incomingTime')
    expect(pipeline[4].$unset).toContain('_prevLastEventTime')
    expect(pipeline[4].$unset).toContain('_customTemp')
    expect(pipeline[4].$unset).toContain('_anotherTemp')
  })

  test('should omit events array stage when skipEventTracking enabled', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      skipEventTracking: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline).toHaveLength(4) // Stage 2 (events) should be skipped
    expect(pipeline[0]).toHaveProperty('$set') // Stage 1: Data
    expect(pipeline[1]).toHaveProperty('$set') // Stage 3a: _prevLastEventTime
    expect(pipeline[2]).toHaveProperty('$set') // Stage 3b: lastEventTime/status
    expect(pipeline[3]).toHaveProperty('$unset') // Stage 4: Cleanup
    expect(pipeline[1].$set).not.toHaveProperty('events')
  })

  test('should omit status tracking stage when skipStatusTracking enabled', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      skipStatusTracking: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline).toHaveLength(3) // Stage 3 should be skipped
    expect(pipeline[0]).toHaveProperty('$set')
    expect(pipeline[1]).toHaveProperty('$set')
    expect(pipeline[2]).toHaveProperty('$unset')
    expect(pipeline[1].$set.events).toBeDefined()
    expect(pipeline[1].$set).not.toHaveProperty('lastEventTime')
    expect(pipeline[1].$set).not.toHaveProperty('status')
  })

  test('should reduce to minimal data-only pipeline when both tracking options disabled', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      skipEventTracking: true,
      skipStatusTracking: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline).toHaveLength(2) // Only stages 1 and 4
    expect(pipeline[0]).toHaveProperty('$set')
    expect(pipeline[1]).toHaveProperty('$unset')
  })

  test('should accept custom event summary format for non-standard event types', () => {
    const customSummary = {
      customField: 'custom-value',
      type: 'custom-type'
    }

    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      customEventSummary: customSummary
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(getEventSummary).not.toHaveBeenCalled()
    expect(pipeline[1].$set.events.$cond.else).toEqual({
      $concatArrays: [{ $ifNull: ['$events', []] }, [customSummary]]
    })
  })

  test('should gracefully omit status extraction when eventTypePrefix not configured', () => {
    const mappings = {
      dataFields: {}
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(getStatusFromTypeSuffix).not.toHaveBeenCalled()
    expect(pipeline[3].$set).not.toHaveProperty('status')
    expect(pipeline[3].$set.lastEventTime).toBeDefined()
  })

  test('should gracefully handle event types that do not match expected prefix pattern', () => {
    getStatusFromTypeSuffix.mockReturnValue(null)

    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[3].$set).not.toHaveProperty('status')
    expect(pipeline[3].$set.lastEventTime).toBeDefined()
  })

  test('should fall back to received timestamp when event.time missing', () => {
    const eventWithoutTime = { ...mockEvent }
    delete eventWithoutTime.time

    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(eventWithoutTime, mockEventEntity, mappings)

    expect(pipeline[0].$set._incomingTime).toEqual(mockEventEntity.received)
  })

  test('should return extensible pipeline allowing custom stages for context-specific needs', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    // Test that pipeline can be modified (e.g., splicing in custom stages)
    const customStage = { $set: { customField: 'custom' } }
    pipeline.splice(2, 0, customStage)

    expect(pipeline).toHaveLength(6)
    expect(pipeline[2]).toEqual(customStage)
  })

  test('should handle empty dataFields', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[0].$set).toHaveProperty('_incomingTime')
    expect(pipeline[0].$set).toHaveProperty('lastUpdated')
    expect(pipeline[0].$set).toHaveProperty('created')
    expect(Object.keys(pipeline[0].$set)).toHaveLength(3)
  })

  test('should handle missing mappings properties with defaults', () => {
    const mappings = {}

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline).toHaveLength(5)
    expect(pipeline[0].$set).toHaveProperty('_incomingTime')
    expect(pipeline[4].$unset).toEqual(['_incomingTime', '_prevLastEventTime'])
  })

  test('should set _prevLastEventTime with $ifNull in stage 3', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.'
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[2].$set._prevLastEventTime).toEqual({
      $ifNull: ['$lastEventTime', new Date(0)]
    })
  })

  test('should not wrap data fields in conditionals when updateOnlyWhenNewer is false', () => {
    const mappings = {
      dataFields: {
        fieldA: 'valueA',
        fieldB: 'valueB'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: false
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[0].$set.fieldA).toBe('valueA')
    expect(pipeline[0].$set.fieldB).toBe('valueB')
    expect(pipeline[0].$set.fieldA).not.toHaveProperty('$cond')
  })

  test('should wrap data fields in conditionals when updateOnlyWhenNewer is true', () => {
    const mappings = {
      dataFields: {
        fieldA: 'valueA',
        fieldB: 'valueB'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    expect(pipeline[0].$set.fieldA).toHaveProperty('$cond')
    expect(pipeline[0].$set.fieldB).toHaveProperty('$cond')
  })

  test('should use correct conditional logic for updateOnlyWhenNewer', () => {
    const mappings = {
      dataFields: {
        amount: 1000,
        status: 'paid'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)
    const incomingTime = new Date(mockEvent.time)

    // Check amount field
    expect(pipeline[0].$set.amount).toEqual({
      $cond: [
        { $gt: [incomingTime, { $ifNull: ['$lastEventTime', new Date(0)] }] },
        1000,
        '$amount'
      ]
    })

    // Check status field
    expect(pipeline[0].$set.status).toEqual({
      $cond: [
        { $gt: [incomingTime, { $ifNull: ['$lastEventTime', new Date(0)] }] },
        'paid',
        '$status'
      ]
    })
  })

  test('should keep existing value when event is older with updateOnlyWhenNewer', () => {
    const mappings = {
      dataFields: {
        fieldA: 'newValue'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    // Verify the conditional preserves existing value when condition is false
    expect(pipeline[0].$set.fieldA.$cond[2]).toBe('$fieldA')
  })

  test('should update value when event is newer with updateOnlyWhenNewer', () => {
    const mappings = {
      dataFields: {
        fieldA: 'newValue'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    // Verify the conditional uses new value when condition is true
    expect(pipeline[0].$set.fieldA.$cond[1]).toBe('newValue')
  })

  test('should compare against epoch for first event with updateOnlyWhenNewer', () => {
    const mappings = {
      dataFields: {
        fieldA: 'valueA'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    // Verify that it uses $ifNull with epoch date for comparison
    expect(pipeline[0].$set.fieldA.$cond[0].$gt[1]).toEqual({
      $ifNull: ['$lastEventTime', new Date(0)]
    })
  })

  test('should handle multiple data fields with updateOnlyWhenNewer', () => {
    const mappings = {
      dataFields: {
        correlationId: 'test-id',
        amount: 5000,
        currency: 'GBP',
        reference: 'REF123'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    // All fields should have conditional logic
    expect(pipeline[0].$set.correlationId).toHaveProperty('$cond')
    expect(pipeline[0].$set.amount).toHaveProperty('$cond')
    expect(pipeline[0].$set.currency).toHaveProperty('$cond')
    expect(pipeline[0].$set.reference).toHaveProperty('$cond')

    // Count the data fields (excluding timestamps)
    const dataFieldKeys = Object.keys(pipeline[0].$set).filter(
      key => !['_incomingTime', 'lastUpdated', 'created'].includes(key)
    )
    expect(dataFieldKeys).toHaveLength(4)
  })

  test('should not affect timestamp fields when updateOnlyWhenNewer is true', () => {
    const mappings = {
      dataFields: {
        fieldA: 'valueA'
      },
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    // Timestamps should not be wrapped in conditionals
    expect(pipeline[0].$set._incomingTime).toBeInstanceOf(Date)
    expect(pipeline[0].$set.lastUpdated).toEqual(mockEventEntity.received)
    expect(pipeline[0].$set.created).toEqual({
      $ifNull: ['$created', mockEventEntity.received]
    })
  })

  test('should work correctly with empty dataFields and updateOnlyWhenNewer', () => {
    const mappings = {
      dataFields: {},
      eventTypePrefix: 'uk.gov.fcp.sfd.test.',
      updateOnlyWhenNewer: true
    }

    const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

    // Should only have timestamp fields
    expect(pipeline[0].$set).toHaveProperty('_incomingTime')
    expect(pipeline[0].$set).toHaveProperty('lastUpdated')
    expect(pipeline[0].$set).toHaveProperty('created')
    expect(Object.keys(pipeline[0].$set)).toHaveLength(3)
  })
})
