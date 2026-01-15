import { getMongoDb } from '../../common/helpers/mongodb.js'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'

const { CRM_EVENT_PREFIX } = eventTypePrefixes

const maxTimeMS = config.get('mongo.maxTimeMS')

const logger = createLogger()

export async function save (event) {
  const { collections } = getMongoDb()
  const { events: eventCollection, crm: crmCollection } = collections

  const now = new Date()
  const eventEntity = { _id: `${event.source}:${event.id}`, ...event, received: now }

  const result = await eventCollection.updateOne(
    { _id: eventEntity._id },
    { $setOnInsert: eventEntity },
    { upsert: true, maxTimeMS }
  )

  if (result.matchedCount > 0) {
    logger.warn(`Skipping duplicate event. ID: ${event.id}`)
    return
  }

  await upsertDocument(event, eventEntity, crmCollection, now)
}

async function upsertDocument (event, eventEntity, crmCollection, now) {
  const { correlationId, caseId, onlineSubmissionActivities } = event.data

  const status = extractStatus(event.type)

  const incomingFileIds = onlineSubmissionActivities
    ? onlineSubmissionActivities
      .filter(activity => activity.fileId)
      .map(activity => activity.fileId)
    : []

  const eventSummary = {
    _id: eventEntity._id,
    type: eventEntity.type,
    source: eventEntity.source,
    id: eventEntity.id,
    time: eventEntity.time,
    subject: eventEntity.subject,
    received: eventEntity.received
  }

  await crmCollection.updateOne(
    { _id: `${correlationId}:${caseId}` },
    [
      {
        $set: {
          _incomingTime: new Date(event.time || now),
          _incomingFileIds: incomingFileIds,
          lastUpdated: now,
          created: { $ifNull: ['$created', now] },
          ...event.data
        }
      },

      {
        $set: {
          events: {
            $cond: {
              if: {
                $in: [eventEntity._id, { $ifNull: [{ $map: { input: '$events', as: 'e', in: '$$e._id' } }, []] }]
              },
              then: '$events', // Event already exists, keep array as-is
              else: { $concatArrays: [{ $ifNull: ['$events', []] }, [eventSummary]] }
            }
          },
          // Merge fileIds: combine existing with incoming, remove duplicates using $setUnion
          fileIds: {
            $cond: {
              if: { $gt: [{ $size: '$_incomingFileIds' }, 0] },
              then: { $setUnion: [{ $ifNull: ['$fileIds', []] }, '$_incomingFileIds'] },
              else: { $ifNull: ['$fileIds', []] }
            }
          }
        }
      },
      {
        $set: {
          _prevLastEventTime: { $ifNull: ['$lastEventTime', new Date(0)] },
          lastEventTime: { $max: ['$lastEventTime', '$_incomingTime'] },

          // only update status if this event time is newer
          ...(status
            ? {
                status: {
                  $cond: [
                    { $gt: ['$_incomingTime', '$_prevLastEventTime'] },
                    status,
                    '$status'
                  ]
                }
              }
            : {})
        }
      },

      { $unset: ['_incomingTime', '_prevLastEventTime', '_incomingFileIds'] }
    ],
    { upsert: true, maxTimeMS }
  )
}

function extractStatus (eventType) {
  if (!eventType.startsWith(CRM_EVENT_PREFIX)) {
    return null
  }
  return eventType.substring(CRM_EVENT_PREFIX.length)
}
