import { config } from '../../../config/config.js'
import { createLogger } from '../logging/logger.js'
import { createMongoDbConnection, getMongoDb } from '../mongodb.js'

const logger = createLogger()

export const healthCheck = async () => {
  const options = config.get('mongo')

  try {
    logger.info(`Connecting to MongoDB database ${options.databaseName}`)
    await createMongoDbConnection(options)
    await getMongoDb().db.command({ ping: 1 })
    logger.info('SUCCESS: Connected to MongoDB')
  } catch (err) {
    logger.error(err, 'Error connecting to MongoDB')
    throw err
  }
}
