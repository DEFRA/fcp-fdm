import { getEventSummary, getStatusFromTypeSuffix } from './cloud-events.js'

/**
 * Builds a MongoDB aggregation pipeline for upserting event-driven documents.
 * Centralizes common pipeline logic for CRM, document, and message save operations.
 *
 * Design assumptions for CloudEvents v1.0 format:
 * - Events have time/received timestamps for ordering
 * - Documents maintain an events array for audit trail
 * - Status updates are time-based (newer events override status)
 *
 * For non-CloudEvents or custom formats:
 * - Override eventSummary via mappings.customEventSummary
 * - Skip event tracking via mappings.skipEventTracking
 * - Inject custom stages into returned pipeline array
 * - Or create a separate pipeline builder function
 *
 * @param {Object} event - CloudEvents format event (or compatible structure)
 * @param {Object} eventEntity - Saved event entity from cloud-events collection
 * @param {Object} mappings - Context-specific field mappings
 * @param {Object} mappings.dataFields - Fields to extract from event.data and set on document
 * @param {string} [mappings.eventTypePrefix] - Event type prefix for status derivation
 * @param {Array<string>} [mappings.unsetFields] - Additional temporary fields to unset in final stage
 * @param {Object} [mappings.customEventSummary] - Override default event summary structure
 * @param {boolean} [mappings.skipEventTracking=false] - Skip event array tracking (stage 2)
 * @param {boolean} [mappings.skipStatusTracking=false] - Skip lastEventTime/status tracking (stage 3)
 * @param {boolean} [mappings.updateOnlyWhenNewer=false] - Only update data fields if event is newer
 * @param {Function} [mappings.beforeEventTracking] - Custom stages to inject before event tracking (receives pipeline, context)
 * @param {Function} [mappings.afterEventTracking] - Custom stages to inject after event tracking (receives pipeline, context)
 * @param {Function} [mappings.beforeStatusTracking] - Custom stages to inject before status tracking (receives pipeline, context)
 * @param {Function} [mappings.afterStatusTracking] - Custom stages to inject after status tracking (receives pipeline, context)
 * @returns {Array} MongoDB aggregation pipeline stages
 */
export function buildSavePipeline (event, eventEntity, mappings) {
  const {
    dataFields = {},
    eventTypePrefix,
    unsetFields = [],
    customEventSummary,
    skipEventTracking = false,
    skipStatusTracking = false,
    updateOnlyWhenNewer = false,
    beforeEventTracking,
    afterEventTracking,
    beforeStatusTracking,
    afterStatusTracking
  } = mappings

  const eventSummary = customEventSummary || getEventSummary(eventEntity)

  const status = eventTypePrefix ? getStatusFromTypeSuffix(event.type, eventTypePrefix) : null

  const pipeline = []

  const incomingTime = new Date(event.time || eventEntity.received)

  // Context object passed to hook functions
  const context = {
    event,
    eventEntity,
    eventSummary,
    status,
    incomingTime,
    dataFields
  }

  // Conditionally wrap data fields if updateOnlyWhenNewer is enabled
  const fieldsToUpdate = updateOnlyWhenNewer
    ? Object.fromEntries(
      Object.entries(dataFields).map(([key, value]) => [
        key,
        {
          $cond: [{ $gt: [incomingTime, { $ifNull: ['$lastEventTime', new Date(0)] }] }, value, `$${key}`]
        }
      ])
    )
    : dataFields

  // Stage 1: Set incoming data, timestamps, and context-specific fields
  pipeline.push({
    $set: {
      _incomingTime: incomingTime,
      lastUpdated: eventEntity.received,
      created: { $ifNull: ['$created', eventEntity.received] },
      ...fieldsToUpdate
    }
  })

  // Hook: Before event tracking
  if (beforeEventTracking) {
    beforeEventTracking(pipeline, context)
  }

  // Stage 2: Handle events array - append new event if not already present (optional)
  if (!skipEventTracking) {
    pipeline.push({
      $set: {
        events: {
          $cond: {
            if: {
              $in: [eventEntity._id, { $ifNull: [{ $map: { input: '$events', as: 'e', in: '$$e._id' } }, []] }]
            },
            then: '$events',
            else: { $concatArrays: [{ $ifNull: ['$events', []] }, [eventSummary]] }
          }
        }
      }
    })
  }

  // Hook: After event tracking
  if (afterEventTracking) {
    afterEventTracking(pipeline, context)
  }

  // Hook: Before status tracking
  if (beforeStatusTracking) {
    beforeStatusTracking(pipeline, context)
  }

  // Stage 3: Update lastEventTime and conditionally update status if event is newer (optional)
  if (!skipStatusTracking) {
    // Stage 3a: Capture previous lastEventTime before updating it
    pipeline.push({
      $set: {
        _prevLastEventTime: { $ifNull: ['$lastEventTime', new Date(0)] }
      }
    },
    {
      $set: {
        lastEventTime: { $max: ['$lastEventTime', '$_incomingTime'] },
        ...(status
          ? {
              status: {
                $cond: [{ $gt: ['$_incomingTime', '$_prevLastEventTime'] }, status, '$status']
              }
            }
          : {})
      }
    })
  }

  // Hook: After status tracking
  if (afterStatusTracking) {
    afterStatusTracking(pipeline, context)
  }

  // Stage 4: Clean up temporary fields
  pipeline.push({
    $unset: ['_incomingTime', '_prevLastEventTime', ...unsetFields]
  })

  return pipeline
}
