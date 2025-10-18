import { getMongoDbClient } from '../../../common/helpers/mongodb.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function saveMessageEvent (event) {
  const db = getMongoDbClient()
  const collection = db.collection('events')

  try {
    await collection.insertOne({ ...event, _id: `${event.source}:${event.id}`, received: new Date() })
  } catch (err) {
    if (err.message.includes('E11000 duplicate key error')) {
      logger.warn(`Skipping duplicate event. ID: ${event.id}`)
    } else {
      throw err
    }
  }
}
