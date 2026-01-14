import { getMongoDb } from '../../common/helpers/mongodb.js'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'

const { DOCUMENT_EVENT_PREFIX } = eventTypePrefixes

const maxTimeMS = config.get('mongo.maxTimeMS')

const logger = createLogger()

export async function save (event) {
  const { collections } = getMongoDb()
  const { events: eventCollection, documents: documentCollection } = collections

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

  await upsertDocument(event, eventEntity, documentCollection, now)
}

async function upsertDocument (event, eventEntity, documentCollection, now) {
  const { correlationId } = event.data
  const { fileId, fileName } = event.data.file || {}

  const status = extractStatus(event.type)

  const eventSummary = {
    _id: eventEntity._id,
    type: eventEntity.type,
    source: eventEntity.source,
    id: eventEntity.id,
    time: eventEntity.time,
    subject: eventEntity.subject,
    received: eventEntity.received
  }

  await documentCollection.updateOne(
    { _id: `${correlationId}:${fileId}` },
    [
      {
        $set: {
          _incomingTime: new Date(event.time || now),
          lastUpdated: now,
          created: { $ifNull: ['$created', now] },
          fileId,
          fileName,
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

      { $unset: ['_incomingTime', '_prevLastEventTime'] }
    ],
    { upsert: true, maxTimeMS }
  )
}

function extractStatus (eventType) {
  if (!eventType.startsWith(DOCUMENT_EVENT_PREFIX)) {
    return null
  }
  return eventType.substring(DOCUMENT_EVENT_PREFIX.length)
}
