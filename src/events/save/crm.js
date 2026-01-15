import { getMongoDb } from '../../common/helpers/mongodb.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'
import { getEventSummary, getStatusFromTypeSuffix, saveCloudEvent } from './cloud-events.js'

const { CRM_EVENT_PREFIX } = eventTypePrefixes

const maxTimeMS = config.get('mongo.maxTimeMS')

export async function save (event) {
  const eventEntity = await saveCloudEvent(event)

  if (eventEntity) {
    await upsertCrmCase(event, eventEntity)
  }
}

async function upsertCrmCase (event, eventEntity) {
  const { collections } = getMongoDb()
  const { crm: crmCollection } = collections

  const { correlationId, caseId, onlineSubmissionActivities } = event.data

  const status = getStatusFromTypeSuffix(event.type, CRM_EVENT_PREFIX)
  const eventSummary = getEventSummary(eventEntity)

  const incomingFileIds = onlineSubmissionActivities
    ? onlineSubmissionActivities
      .filter(activity => activity.fileId)
      .map(activity => activity.fileId)
    : []

  await crmCollection.updateOne(
    { _id: `${correlationId}:${caseId}` },
    [
      {
        $set: {
          _incomingTime: new Date(event.time || eventEntity.received),
          _incomingFileIds: incomingFileIds,
          lastUpdated: eventEntity.received,
          created: { $ifNull: ['$created', eventEntity.received] },
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
