import { getMongoDbClient } from '../../../common/helpers/mongodb.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function saveMessageEvent (event) {
  const db = getMongoDbClient()
  const collection = db.collection('events')

  try {
    const { correlationId, recipient } = event.data
    const eventEntity = { ...event, _id: `${event.source}:${event.id}`, received: new Date() }

    await db.collection('messages').updateOne(
      { _id: correlationId, recipient },
      { $push: { events: eventEntity } },
      { upsert: true }
    )

    await collection.insertOne(eventEntity)

    logger.info(`Saved message event. ID: ${event.id}, Correlation ID: ${correlationId}`)
  } catch (err) {
    if (err.message.includes('E11000 duplicate key error')) {
      logger.warn(`Skipping duplicate event. ID: ${event.id}`)
    } else {
      throw err
    }
  }
}
