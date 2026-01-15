import { getMongoDb } from '../../common/helpers/mongodb.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'
import { saveCloudEvent } from './cloud-events.js'
import { buildSavePipeline } from './pipeline.js'

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

  const pipeline = buildSavePipeline(event, eventEntity, {
    eventTypePrefix: MESSAGE_EVENT_PREFIX,
    dataFields: {
      ...(recipient ? { recipient } : {}),
      ...(subject ? { subject } : {}),
      ...(body ? { body } : {}),
      ...(crn ? { crn } : {}),
      ...(sbi ? { sbi } : {})
    }
  })

  await messageCollection.updateOne(
    { _id: correlationId },
    pipeline,
    { upsert: true, maxTimeMS }
  )
}
