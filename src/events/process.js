import { createLogger } from '../common/helpers/logging/logger.js'
import { isEventValid } from './validate.js'
import { getMongoDbClient } from '../common/helpers/mongodb.js'

const logger = createLogger()

export async function processEventMessage (message) {
  const event = JSON.parse(JSON.parse(message.Body).Message)

  if (isEventValid(event)) {
    logger.info('Valid event')
    logger.info(event)

    const db = getMongoDbClient()
    const eventsTempCollection = db.collection('events-temp')

    try {
      await eventsTempCollection.insertOne({ ...event, receivedUtc: new Date().toISOString() })
    } catch (err) {
      logger.error(err, 'Failed to insert event into event collection')
    }
  } else {
    logger.error('Invalid event')
    logger.error(event)
  }
}
