import { getMongoDb } from '../../common/helpers/mongodb.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'
import { saveCloudEvent } from './cloud-events.js'
import { buildSavePipeline } from './pipeline.js'

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

  const incomingFileIds = onlineSubmissionActivities
    ? onlineSubmissionActivities
      .filter(activity => activity.fileId)
      .map(activity => activity.fileId)
    : []

  const pipeline = buildSavePipeline(event, eventEntity, {
    eventTypePrefix: CRM_EVENT_PREFIX,
    dataFields: {
      _incomingFileIds: incomingFileIds,
      ...event.data
    },
    unsetFields: ['_incomingFileIds']
  })

  // Insert CRM-specific fileIds merge logic after stage 2 (events)
  pipeline.splice(2, 0, {
    $set: {
      fileIds: {
        $cond: {
          if: { $gt: [{ $size: '$_incomingFileIds' }, 0] },
          then: { $setUnion: [{ $ifNull: ['$fileIds', []] }, '$_incomingFileIds'] },
          else: { $ifNull: ['$fileIds', []] }
        }
      }
    }
  })

  await crmCollection.updateOne(
    { _id: `${correlationId}:${caseId}` },
    pipeline,
    { upsert: true, maxTimeMS }
  )
}
