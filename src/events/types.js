export function getEventType (type) {
  if (type === MESSAGE_EVENT_REJECTED_PREFIX) {
    return MESSAGE_EVENT_REJECTED
  }

  if (type.startsWith(MESSAGE_EVENT_PREFIX)) {
    return MESSAGE_EVENT
  }

  throw new Error(`Unknown event type: ${type}`)
}

const MESSAGE_EVENT_REJECTED_PREFIX = 'uk.gov.fcp.sfd.notification.failure.validation'
const MESSAGE_EVENT_REJECTED = 'messageRejected'

const MESSAGE_EVENT_PREFIX = 'uk.gov.fcp.sfd.notification.'
const MESSAGE_EVENT = 'message'

export const eventTypes = {
  MESSAGE_EVENT,
  MESSAGE_EVENT_REJECTED
}

export const eventTypePrefixes = {
  MESSAGE_EVENT_PREFIX,
  MESSAGE_EVENT_REJECTED_PREFIX
}
