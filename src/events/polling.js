import { consumeEvents } from './consumer.js'
import { config } from '../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const { sqs } = config.get('aws')
const logger = createLogger()

let backOff = sqs.pollingInterval
const maxBackOff = Math.max(15000, sqs.pollingInterval * 15)
const minBackOff = 5

const jitter = (ms) => Math.round(ms * (0.8 + Math.random() * 0.4))

let inFlight = false

export async function pollForEvents () {
  if (inFlight) {
    return
  }

  inFlight = true

  try {
    const hadEvents = await consumeEvents()
    if (hadEvents) {
      backOff = sqs.pollingInterval
      setTimeout(pollForEvents, minBackOff)
    } else {
      backOff = Math.min(maxBackOff, backOff * 2)
      setTimeout(pollForEvents, jitter(backOff))
    }
  } catch (err) {
    logger.error(err, 'Error polling for event messages')
    backOff = Math.min(maxBackOff, Math.max(1000, backOff * 2))
    setTimeout(pollForEvents, jitter(backOff))
  } finally {
    inFlight = false
  }
}
