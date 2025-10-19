import { describe, test, beforeEach } from 'vitest'
import { createSqsSender } from '../../helpers/sqs-sender.js'
import { getScenario } from '../../events/messages/scenarios.js'

/**
 * Example test file showing how to use the SQS sender and scenarios
 * in your test suite for integration testing
 */

describe('Event Processing Integration Tests', () => {
  let sqsSender

  beforeEach(() => {
    sqsSender = createSqsSender()
  })

  test('should process a successful message stream', async () => {
    const events = getScenario('streams.successful')

    // Send the scenario events
    await sqsSender.sendScenario(events, {
      name: 'Successful Stream Test',
      delayBetween: 100 // Faster for tests
    })

    // Add your assertions here
    // For example, check database state, logs, etc.
  })

  test('should handle validation failures', async () => {
    const events = getScenario('streams.validationFailure')

    await sqsSender.sendEvents(events, { delayBetween: 50 })

    // Assert validation failure was handled correctly
  })
})

describe('Individual Event Tests', () => {
  let sqsSender

  beforeEach(() => {
    sqsSender = createSqsSender()
  })

  test('should process message request event', async () => {
    const events = getScenario('single.messageRequest')

    await sqsSender.sendEvent(events[0])

    // Assert message request was processed
  })

  test('should handle provider failure event', async () => {
    const events = getScenario('single.statusProviderFailure')

    await sqsSender.sendEvent(events[0])

    // Assert provider failure was handled
  })
})
