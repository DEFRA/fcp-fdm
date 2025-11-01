import { consumeEvents } from './consumer.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const DEFAULT_BACK_OFF = 1000
const MAX_BACK_OFF = 32000
const MIN_BACK_OFF = 5

let currentBackOff = DEFAULT_BACK_OFF

// Jitter function to add randomness to back-off intervals to avoid thundering herd problem
const JITTER_FACTOR = 0.2 // Jitter range ±20%
const jitter = ms => Math.round(ms * (1 + JITTER_FACTOR * (Math.random() - 0.5)))

let inFlight = false
let pollTimeout = null
let enabled = false

export function startPolling () {
  if (enabled) {
    return
  }

  enabled = true
  logger.info('Starting event polling')
  pollForEvents()
}

export function stopPolling () {
  if (!enabled) {
    return
  }

  enabled = false

  if (pollTimeout) {
    clearTimeout(pollTimeout)
    pollTimeout = null
  }

  logger.info('Event polling stopped')
}

export async function pollForEvents () {
  if (inFlight || !enabled) {
    return
  }

  inFlight = true

  try {
    const hadEvents = await consumeEvents()

    if (hadEvents) {
      currentBackOff = MIN_BACK_OFF
    } else {
      currentBackOff = Math.min(MAX_BACK_OFF, currentBackOff * 2)
    }
  } catch (err) {
    logger.error(err, 'Error polling for event messages')
    currentBackOff = MAX_BACK_OFF
  } finally {
    inFlight = false

    if (enabled) {
      if (pollTimeout) {
        clearTimeout(pollTimeout)
        pollTimeout = null
      }

      const delay = currentBackOff === MIN_BACK_OFF ? MIN_BACK_OFF : jitter(currentBackOff)
      pollTimeout = setTimeout(pollForEvents, delay)
    }
  }
}
