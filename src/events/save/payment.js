import { getMongoDb } from '../../common/helpers/mongodb.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'
import { saveCloudEvent } from './cloud-events.js'
import { buildSavePipeline } from './pipeline.js'

const { PAYMENT_EVENT_PREFIX } = eventTypePrefixes

const maxTimeMS = config.get('mongo.maxTimeMS')

export async function save (event) {
  const eventEntity = await saveCloudEvent(event)

  if (eventEntity) {
    await upsertPayment(event, eventEntity)
  }
}

async function upsertPayment (event, eventEntity) {
  const { collections } = getMongoDb()
  const { payments: paymentCollection } = collections

  const { correlationId } = event.data

  const pipeline = buildSavePipeline(event, eventEntity, {
    eventTypePrefix: PAYMENT_EVENT_PREFIX,
    dataFields: {
      ...event.data
    },
    updateOnlyWhenNewer: true
  })

  await paymentCollection.updateOne(
    { _id: correlationId },
    pipeline,
    { upsert: true, maxTimeMS }
  )
}
