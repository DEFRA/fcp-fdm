import { getMongoDb } from '../../common/helpers/mongodb.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'
import { saveCloudEvent } from './cloud-events.js'
import { buildSavePipeline } from './pipeline.js'

const { DOCUMENT_EVENT_PREFIX } = eventTypePrefixes

const maxTimeMS = config.get('mongo.maxTimeMS')

export async function save (event) {
  const eventEntity = await saveCloudEvent(event)

  if (eventEntity) {
    await upsertDocument(event, eventEntity)
  }
}

async function upsertDocument (event, eventEntity) {
  const { collections } = getMongoDb()
  const { documents: documentCollection } = collections

  const { correlationId } = event.data
  const { fileId, fileName } = event.data.file || {}

  const pipeline = buildSavePipeline(event, eventEntity, {
    eventTypePrefix: DOCUMENT_EVENT_PREFIX,
    dataFields: {
      fileId,
      fileName,
      ...event.data
    }
  })

  await documentCollection.updateOne(
    { _id: `${correlationId}:${fileId}` },
    pipeline,
    { upsert: true, maxTimeMS }
  )
}
