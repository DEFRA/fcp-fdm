import { getMongoDb } from '../../common/helpers/mongodb.js'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { config } from '../../config/config.js'

const maxTimeMS = config.get('mongo.maxTimeMS')

const logger = createLogger()

export async function saveCloudEvent (event) {
  const { collections } = getMongoDb()
  const { events: eventCollection } = collections

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

  return eventEntity
}

export function getEventSummary (event) {
  return {
    _id: event._id,
    type: event.type,
    source: event.source,
    id: event.id,
    time: event.time,
    subject: event.subject,
    received: event.received
  }
}

export function getStatusFromTypeSuffix (eventType, prefix) {
  if (!eventType.startsWith(prefix)) {
    return null
  }

  return eventType.substring(prefix.length)
}
