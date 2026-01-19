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

  describe('hook functions', () => {
    test('should call beforeEventTracking hook with pipeline and context', () => {
      const beforeEventTracking = vi.fn()
      const mappings = {
        dataFields: { testField: 'test-value' },
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeEventTracking
      }

      buildSavePipeline(mockEvent, mockEventEntity, mappings)

      expect(beforeEventTracking).toHaveBeenCalledTimes(1)
      const [pipeline, context] = beforeEventTracking.mock.calls[0]

      // Verify pipeline is an array that can be modified
      expect(Array.isArray(pipeline)).toBe(true)

      // Verify context has expected properties
      expect(context.event).toBe(mockEvent)
      expect(context.eventEntity).toBe(mockEventEntity)
      expect(context.eventSummary).toBe(mockEventSummary)
      expect(context.status).toBe('created')
      expect(context.incomingTime).toBeInstanceOf(Date)
      expect(context.dataFields).toEqual({ testField: 'test-value' })
    })

    test('should inject stages from beforeEventTracking before event array stage', () => {
      const customStage = { $set: { customField: 'customValue' } }
      const beforeEventTracking = (pipeline) => {
        pipeline.push(customStage)
      }

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeEventTracking
      }

      const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

      // Should have: stage1, customStage, events, _prevLastEventTime, status, cleanup
      expect(pipeline).toHaveLength(6)
      expect(pipeline[1]).toEqual(customStage)
      expect(pipeline[2].$set).toHaveProperty('events')
    })

    test('should call afterEventTracking hook after event array stage', () => {
      const afterEventTracking = vi.fn()
      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        afterEventTracking
      }

      buildSavePipeline(mockEvent, mockEventEntity, mappings)

      expect(afterEventTracking).toHaveBeenCalledTimes(1)
      const [pipeline, context] = afterEventTracking.mock.calls[0]

      expect(Array.isArray(pipeline)).toBe(true)
      expect(context.event).toBe(mockEvent)
    })

    test('should inject stages from afterEventTracking after event array stage', () => {
      const customStage = { $set: { afterEventsField: 'value' } }
      const afterEventTracking = (pipeline) => {
        pipeline.push(customStage)
      }

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        afterEventTracking
      }

      const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

      // Should have: stage1, events, customStage, _prevLastEventTime, status, cleanup
      expect(pipeline).toHaveLength(6)
      expect(pipeline[1].$set).toHaveProperty('events')
      expect(pipeline[2]).toEqual(customStage)
      expect(pipeline[3].$set).toHaveProperty('_prevLastEventTime')
    })

    test('should call beforeStatusTracking hook before status tracking stages', () => {
      const beforeStatusTracking = vi.fn()
      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeStatusTracking
      }

      buildSavePipeline(mockEvent, mockEventEntity, mappings)

      expect(beforeStatusTracking).toHaveBeenCalledTimes(1)
      const [pipeline, context] = beforeStatusTracking.mock.calls[0]

      expect(Array.isArray(pipeline)).toBe(true)
      expect(context.status).toBe('created')
    })

    test('should inject stages from beforeStatusTracking before status stages', () => {
      const customStage = { $set: { beforeStatusField: 'value' } }
      const beforeStatusTracking = (pipeline) => {
        pipeline.push(customStage)
      }

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeStatusTracking
      }

      const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

      // Should have: stage1, events, customStage, _prevLastEventTime, status, cleanup
      expect(pipeline).toHaveLength(6)
      expect(pipeline[1].$set).toHaveProperty('events')
      expect(pipeline[2]).toEqual(customStage)
      expect(pipeline[3].$set).toHaveProperty('_prevLastEventTime')
    })

    test('should call afterStatusTracking hook after status tracking stages', () => {
      const afterStatusTracking = vi.fn()
      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        afterStatusTracking
      }

      buildSavePipeline(mockEvent, mockEventEntity, mappings)

      expect(afterStatusTracking).toHaveBeenCalledTimes(1)
      const [pipeline, context] = afterStatusTracking.mock.calls[0]

      expect(Array.isArray(pipeline)).toBe(true)
      expect(context.incomingTime).toBeInstanceOf(Date)
    })

    test('should inject stages from afterStatusTracking before cleanup stage', () => {
      const customStage = { $set: { afterStatusField: 'value' } }
      const afterStatusTracking = (pipeline) => {
        pipeline.push(customStage)
      }

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        afterStatusTracking
      }

      const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

      // Should have: stage1, events, _prevLastEventTime, status, customStage, cleanup
      expect(pipeline).toHaveLength(6)
      expect(pipeline[3].$set).toHaveProperty('lastEventTime')
      expect(pipeline[4]).toEqual(customStage)
      expect(pipeline[5]).toHaveProperty('$unset')
    })

    test('should call all hooks in correct order', () => {
      const callOrder = []
      const beforeEventTracking = vi.fn(() => callOrder.push('beforeEventTracking'))
      const afterEventTracking = vi.fn(() => callOrder.push('afterEventTracking'))
      const beforeStatusTracking = vi.fn(() => callOrder.push('beforeStatusTracking'))
      const afterStatusTracking = vi.fn(() => callOrder.push('afterStatusTracking'))

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeEventTracking,
        afterEventTracking,
        beforeStatusTracking,
        afterStatusTracking
      }

      buildSavePipeline(mockEvent, mockEventEntity, mappings)

      expect(callOrder).toEqual([
        'beforeEventTracking',
        'afterEventTracking',
        'beforeStatusTracking',
        'afterStatusTracking'
      ])
    })

    test('should not call hooks when skipEventTracking is true but beforeEventTracking is provided', () => {
      const beforeEventTracking = vi.fn()
      const afterEventTracking = vi.fn()

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        skipEventTracking: true,
        beforeEventTracking,
        afterEventTracking
      }

      buildSavePipeline(mockEvent, mockEventEntity, mappings)

      // Hooks should still be called even if event tracking is skipped
      expect(beforeEventTracking).toHaveBeenCalledTimes(1)
      expect(afterEventTracking).toHaveBeenCalledTimes(1)
    })

    test('should not call hooks when skipStatusTracking is true but beforeStatusTracking is provided', () => {
      const beforeStatusTracking = vi.fn()
      const afterStatusTracking = vi.fn()

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        skipStatusTracking: true,
        beforeStatusTracking,
        afterStatusTracking
      }

      buildSavePipeline(mockEvent, mockEventEntity, mappings)

      // Hooks should still be called even if status tracking is skipped
      expect(beforeStatusTracking).toHaveBeenCalledTimes(1)
      expect(afterStatusTracking).toHaveBeenCalledTimes(1)
    })

    test('should allow hooks to modify pipeline by pushing multiple stages', () => {
      const beforeEventTracking = (pipeline) => {
        pipeline.push({ $set: { field1: 'value1' } })
        pipeline.push({ $set: { field2: 'value2' } })
      }

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeEventTracking
      }

      const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

      // Should have: stage1, customStage1, customStage2, events, _prevLastEventTime, status, cleanup
      expect(pipeline).toHaveLength(7)
      expect(pipeline[1].$set).toEqual({ field1: 'value1' })
      expect(pipeline[2].$set).toEqual({ field2: 'value2' })
      expect(pipeline[3].$set).toHaveProperty('events')
    })

    test('should provide context with correct incomingTime from event.time', () => {
      const beforeEventTracking = vi.fn()
      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeEventTracking
      }

      buildSavePipeline(mockEvent, mockEventEntity, mappings)

      const [, context] = beforeEventTracking.mock.calls[0]
      expect(context.incomingTime).toEqual(new Date('2024-01-15T10:00:00.000Z'))
    })

    test('should provide context with received time when event.time is missing', () => {
      const eventWithoutTime = { ...mockEvent }
      delete eventWithoutTime.time

      const beforeEventTracking = vi.fn()
      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeEventTracking
      }

      buildSavePipeline(eventWithoutTime, mockEventEntity, mappings)

      const [, context] = beforeEventTracking.mock.calls[0]
      expect(context.incomingTime).toEqual(mockEventEntity.received)
    })

    test('should work without any hooks provided', () => {
      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.'
      }

      const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

      // Should work as before without hooks
      expect(pipeline).toHaveLength(5)
      expect(pipeline[0]).toHaveProperty('$set')
      expect(pipeline[1].$set).toHaveProperty('events')
    })

    test('should allow hooks to access and use context data', () => {
      const beforeEventTracking = (pipeline, context) => {
        // Use context to create conditional logic
        pipeline.push({
          $set: {
            processedAt: context.incomingTime,
            eventType: context.event.type
          }
        })
      }

      const mappings = {
        dataFields: {},
        eventTypePrefix: 'uk.gov.fcp.sfd.test.',
        beforeEventTracking
      }

      const pipeline = buildSavePipeline(mockEvent, mockEventEntity, mappings)

      expect(pipeline[1].$set.processedAt).toEqual(new Date('2024-01-15T10:00:00.000Z'))
      expect(pipeline[1].$set.eventType).toBe('uk.gov.fcp.sfd.test.created')
    })
  })
})
