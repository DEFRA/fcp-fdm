import { createLogger } from '../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function save (event) {
  logger.info(`Skipping save of unsupported event ${event.type} with ID: ${event.id}`)
}
