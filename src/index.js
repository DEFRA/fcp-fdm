import process from 'node:process'

import { createLogger } from './common/helpers/logging/logger.js'
import { startServer } from './common/helpers/start-server.js'
import { pollForEvents } from './events/polling.js'

const logger = createLogger()

await startServer()
await pollForEvents()

process.on('unhandledRejection', (err) => {
  logger.info('Unhandled rejection')
  logger.error(err)
  process.exitCode = 1
})
