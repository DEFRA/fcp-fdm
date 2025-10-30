import { consumeEvents } from './consumer.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const DEFAULT_BACK_OFF = 1000
const MAX_BACK_OFF = 32000
const MIN_BACK_OFF = 5

let currentBackOff = 1000

// Jitter function to add randomness to back-off intervals to avoid thundering herd problem
const JITTER_FACTOR = 0.2 // Jitter range ±20%
const jitter = ms => Math.round(ms * (1 + JITTER_FACTOR * (Math.random() - 0.5)))

let inFlight = false

export async function pollForEvents () {
  if (inFlight) {
    return
  }

  inFlight = true

  try {
    const hadEvents = await consumeEvents()
    if (hadEvents) {
      currentBackOff = DEFAULT_BACK_OFF
      setTimeout(pollForEvents, MIN_BACK_OFF)
    } else {
      currentBackOff = Math.min(MAX_BACK_OFF, currentBackOff * 2)
      setTimeout(pollForEvents, jitter(currentBackOff))
    }
  } catch (err) {
    logger.error(err, 'Error polling for event messages')
    currentBackOff = MAX_BACK_OFF
    setTimeout(pollForEvents, jitter(currentBackOff))
  } finally {
    inFlight = false
  }
}
