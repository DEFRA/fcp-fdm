import { getMongoDbClient } from '../../../common/helpers/mongodb.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function saveMessageEvent (event) {
  const db = getMongoDbClient()
  const collection = db.collection('events-message')

  try {
    await collection.insertOne({ ...event, received: new Date() })
  } catch (err) {
    if (err.message.includes('E11000 duplicate key error')) {
      logger.error(err, 'Failed to insert event into messages collection')
    } else {
      throw err
    }
  }
}
