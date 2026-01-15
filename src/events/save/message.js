import { getMongoDb } from '../../common/helpers/mongodb.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'
import { getEventSummary, getStatusFromTypeSuffix, saveCloudEvent } from './cloud-events.js'

const { MESSAGE_EVENT_PREFIX } = eventTypePrefixes

const maxTimeMS = config.get('mongo.maxTimeMS')

export async function save (event) {
  const eventEntity = await saveCloudEvent(event)

  if (eventEntity) {
    await upsertMessage(event, eventEntity)
  }
}

async function upsertMessage (event, eventEntity) {
  const { collections } = getMongoDb()
  const { messages: messageCollection } = collections

  const { correlationId, recipient, crn, sbi } = event.data
  const { subject, body } = event.data.content || {}

  const status = getStatusFromTypeSuffix(event.type, MESSAGE_EVENT_PREFIX)
  const eventSummary = getEventSummary(eventEntity)

  await messageCollection.updateOne(
    { _id: correlationId },
    [
      {
        $set: {
          _incomingTime: new Date(event.time || eventEntity.received),
          lastUpdated: eventEntity.received,
          created: { $ifNull: ['$created', eventEntity.received] },
          ...(recipient ? { recipient } : {}),
          ...(subject ? { subject } : {}),
          ...(body ? { body } : {}),
          ...(crn ? { crn } : {}),
          ...(sbi ? { sbi } : {})
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
