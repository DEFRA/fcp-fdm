import { getMongoDbClient } from '../../../common/helpers/mongodb.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function saveMessageEvent (event) {
  const db = getMongoDbClient()
  const eventsTempCollection = db.collection('event-messages')

  try {
    await eventsTempCollection.insertOne({ ...event, receivedUtc: new Date().toISOString() })
  } catch (err) {
    logger.error(err, 'Failed to insert event into messages collection')
    // if duplicate event log, if not duplicate throw error
  }
}
