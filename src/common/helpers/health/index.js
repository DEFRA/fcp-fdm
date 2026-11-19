import { createLogger } from '../logging/logger.js'
import { healthCheck as mongo } from './mongo.js'
import { healthCheck as sqs } from './sqs.js'

const healthChecks = [mongo, sqs]

/**
 * runs all registered startup health checks.
 *
 * each check logs its own failure; if any check fails the process is terminated
 * rather than starting a service that cannot do its job.
 */
export const runHealthChecks = async () => {
  try {
    await Promise.all(healthChecks.map((check) => check()))
  } catch (err) {
    createLogger().error(err, 'Unrecoverable startup health check error, shutting down')
    process.exit(1)
  }
}
