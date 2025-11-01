import process from 'node:process'

import { createLogger } from './common/helpers/logging/logger.js'
import { startServer } from './common/helpers/start-server.js'
import { startPolling, stopPolling } from './events/polling.js'
import { closeMongoDbConnection } from './common/helpers/mongodb.js'

await startServer()
startPolling()

async function shutdown () {
  stopPolling()
  await closeMongoDbConnection()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

process.on('unhandledRejection', (err) => {
  const logger = createLogger()
  logger.info('Unhandled rejection')
  logger.error(err)
  process.exitCode = 1
})
