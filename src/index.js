import process from 'node:process'

import { createLogger } from './common/helpers/logging/logger.js'
import { startServer } from './common/helpers/start-server.js'
import { startPolling, stopPolling } from './events/polling.js'
import { closeMongoDbConnection } from './common/helpers/mongodb.js'

const logger = createLogger()

await startServer()
startPolling()

const shutdown = async (signal) => {
  stopPolling()
  await closeMongoDbConnection()

  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (err) => {
  logger.info('Unhandled rejection')
  logger.error(err)
  process.exitCode = 1
})
