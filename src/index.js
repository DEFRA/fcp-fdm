import process from 'node:process'

import { createLogger } from './common/helpers/logging/logger.js'
import { startServer } from './common/helpers/start-server.js'
import { startPolling, stopPolling } from './events/polling.js'
import { closeMongoDbConnection } from './common/helpers/mongodb.js'

const logger = createLogger()

const server = await startServer()
startPolling()

const shutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`)

  stopPolling()

  try {
    await server?.stop({ timeout: 10000 })
    logger.info('Server stopped')
  } catch (err) {
    logger.error(err, 'Error stopping server')
  }

  try {
    await closeMongoDbConnection()
    logger.info('MongoDB connection closed')
  } catch (err) {
    logger.error(err, 'Error closing MongoDB connection')
  }

  logger.info('Shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (err) => {
  logger.info('Unhandled rejection')
  logger.error(err)
  process.exitCode = 1
})
