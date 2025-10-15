import process from 'node:process'

import { createLogger } from './common/helpers/logging/logger.js'
import { startServer } from './common/helpers/start-server.js'
import { pollForEventMessages } from './events/polling.js'

await startServer()
await pollForEventMessages()

process.on('unhandledRejection', (err) => {
  const logger = createLogger()
  logger.info('Unhandled rejection')
  logger.error(err)
  process.exitCode = 1
})
