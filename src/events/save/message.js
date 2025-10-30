import { getMongoDb } from '../../common/helpers/mongodb.js'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { eventTypePrefixes } from '../types.js'

const { MESSAGE_EVENT_PREFIX } = eventTypePrefixes

const logger = createLogger()

export async function save (event) {
  const { correlationId, recipient, crn, sbi } = event.data
  const { subject, body } = event.data.content || {}
  const status = extractStatus(event.type)

  const { db, collections } = getMongoDb()
  const { events: eventCollection, messages: messageCollection } = collections

  const now = new Date()
  const eventEntity = { _id: `${event.source}:${event.id}`, ...event, received: now }

  try {
    // save new event
    await db.collection(eventCollection).insertOne(eventEntity)
  } catch (err) {
    if (err.message.includes('E11000 duplicate key error')) {
      logger.warn(`Skipping duplicate event. ID: ${event.id}`)
    } else {
      throw err
    }
  }

  const eventSummary = {
    _id: eventEntity._id,
    type: eventEntity.type,
    source: eventEntity.source,
    id: eventEntity.id,
    time: eventEntity.time,
    subject: eventEntity.subject,
    received: eventEntity.received
  }

  // save new/update existing message
  await db.collection(messageCollection).updateOne(
    { _id: correlationId },
    [
      {
        $set: {
          _incomingTime: new Date(event.time || now),
          lastUpdated: now,
          created: { $ifNull: ['$created', now] },
          ...(recipient ? { recipient } : {}),
          ...(subject ? { subject } : {}),
          ...(body ? { body } : {}),
          ...(crn ? { crn } : {}),
          ...(sbi ? { sbi } : {})
        }
      },

      // rebuild events: remove any existing copy with same _id, then append the full new event
      {
        $set: {
          events: {
            $let: {
              vars: { evs: { $ifNull: ['$events', []] } },
              in: {
                $concatArrays: [
                  {
                    $filter: {
                      input: '$$evs',
                      as: 'e',
                      cond: { $ne: ['$$e._id', eventEntity._id] }
                    }
                  },
                  [eventSummary]
                ]
              }
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

      // tidy up temp fields
      { $unset: ['_incomingTime', '_prevLastEventTime'] }
    ],
    { upsert: true }
  )

  logger.info(`Saved message event. ID: ${event.id}, Correlation ID: ${correlationId}, Status: ${status}`)
}

function extractStatus (eventType) {
  if (!eventType.startsWith(MESSAGE_EVENT_PREFIX)) {
    return null
  }
  return eventType.substring(MESSAGE_EVENT_PREFIX.length)
}
