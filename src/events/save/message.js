import { getMongoDb } from '../../common/helpers/mongodb.js'
import { createLogger } from '../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function save (event) {
  const { correlationId, recipient, body, subject } = event.data

  const { db, client, collections } = getMongoDb()
  const { events: eventCollection, messages: messageCollection } = collections
  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      const now = new Date()

      const eventEntity = { _id: `${event.source}:${event.id}`, ...event, received: now }

      await db.collection(eventCollection).insertOne(eventEntity, { session })

      await db.collection(messageCollection).updateOne(
        { _id: correlationId },
        {
          $setOnInsert: { _id: correlationId, recipient, created: now },
          $set: {
            lastUpdated: now,
            ...(subject && { subject }),
            ...(body && { body })
          },
          $push: { events: eventEntity }
        },
        { session, upsert: true }
      )
    })

    logger.info(`Saved message event. ID: ${event.id}, Correlation ID: ${correlationId}`)
  } catch (err) {
    if (err.message.includes('E11000 duplicate key error')) {
      logger.warn(`Skipping duplicate event. ID: ${event.id}`)
    } else {
      throw err
    }
  } finally {
    await session.endSession()
  }
}
