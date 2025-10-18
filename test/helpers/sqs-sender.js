import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

/**
 * SQS Event Sender Utility
 *
 * Sends CloudEvents-compliant messages to SQS via LocalStack
 * Wraps events in SNS message format as expected by the consumer
 */
class SqsSender {
  constructor (options = {}) {
    const {
      queueUrl = 'http://localhost:4566/000000000000/fcp_fdm_events',
      region = 'eu-west-2',
      endpoint = 'http://localhost:4566',
      credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    } = options

    this.queueUrl = queueUrl
    this.sqsClient = new SQSClient({
      region,
      ...(endpoint && {
        endpoint,
        credentials
      })
    })
  }

  /**
   * Send a single CloudEvents message
   * @param {Object} event - CloudEvents-compliant event object
   * @returns {Promise<Object>} SQS response with MessageId
   */
  async sendEvent (event) {
    const snsWrappedMessage = {
      Message: JSON.stringify(event)
    }

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(snsWrappedMessage)
    })

    try {
      const response = await this.sqsClient.send(command)
      console.log(`✓ Event sent successfully - ID: ${response.MessageId}`)
      console.log(`  Type: ${event.type}`)
      console.log(`  Correlation ID: ${event.data?.correlationId || 'N/A'}`)
      return response
    } catch (error) {
      console.error(`✗ Failed to send event: ${error.message}`)
      throw error
    }
  }

  /**
   * Send multiple events in sequence
   * @param {Array<Object>} events - Array of CloudEvents-compliant event objects
   * @param {Object} options - Options for delays between events
   * @returns {Promise<Array<Object>>} Array of SQS responses
   */
  async sendEvents (events, options = {}) {
    const { delayBetween = 100 } = options
    const responses = []

    console.log(`Sending ${events.length} events...`)

    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      console.log(`\n[${i + 1}/${events.length}] Sending event:`)

      const response = await this.sendEvent(event)
      responses.push(response)

      // Add delay between messages if specified
      if (delayBetween > 0 && i < events.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetween))
      }
    }

    console.log(`\n✓ All ${events.length} events sent successfully`)
    return responses
  }

  /**
   * Send a complete message stream scenario
   * @param {Array<Object>} scenario - Array of events representing a complete stream
   * @param {Object} options - Options including delays
   * @returns {Promise<Array<Object>>} Array of SQS responses
   */
  async sendScenario (scenario, options = {}) {
    const { name = 'Custom Scenario', delayBetween = 1000 } = options

    console.log(`\n🚀 Starting scenario: ${name}`)
    console.log(`📋 Events in scenario: ${scenario.length}`)

    return this.sendEvents(scenario, { ...options, delayBetween })
  }
}

/**
 * Create a pre-configured SQS sender for LocalStack
 * @param {Object} options - Override default options
 * @returns {SqsSender} Configured SQS sender instance
 */
export function createSqsSender (options = {}) {
  return new SqsSender(options)
}

/**
 * Quick send function for single events
 * @param {Object} event - CloudEvents-compliant event
 * @returns {Promise<Object>} SQS response
 */
export async function sendEvent (event) {
  const sender = createSqsSender()
  return sender.sendEvent(event)
}

/**
 * Quick send function for multiple events
 * @param {Array<Object>} events - Array of CloudEvents-compliant events
 * @param {Object} options - Optional configuration
 * @returns {Promise<Array<Object>>} Array of SQS responses
 */
export async function sendEvents (events, options = {}) {
  const sender = createSqsSender()
  return sender.sendEvents(events, options)
}

export { SqsSender }
