import { getMongoDbClient } from '../../../common/helpers/mongodb.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function saveMessageEvent (event) {
  const db = getMongoDbClient()

  try {
    const { correlationId, recipient, body, subject } = event.data

    const eventEntity = { _id: `${event.source}:${event.id}`, ...event, received: new Date() }

    await db.collection('events').insertOne(eventEntity)

    const messageEntity = { _id: correlationId, recipient }

    if (subject) {
      messageEntity.subject = subject
    }

    if (body) {
      messageEntity.body = body
    }

    await db.collection('messages').updateOne(
      messageEntity,
      { $push: { events: eventEntity } },
      { upsert: true }
    )

    logger.info(`Saved message event. ID: ${event.id}, Correlation ID: ${correlationId}`)
  } catch (err) {
    if (err.message.includes('E11000 duplicate key error')) {
      logger.warn(`Skipping duplicate event. ID: ${event.id}`)
    } else {
      throw err
    }
  }
}
