export function getEventType (type) {
  if (type.startsWith(MESSAGE_EVENT_PREFIX)) {
    return MESSAGE_EVENT
  } else {
    throw new Error(`Unknown event type: ${type}`)
  }
}

const MESSAGE_EVENT_PREFIX = 'uk.gov.fcp.sfd.notification'
const MESSAGE_EVENT = 'message'

export const eventTypes = {
  MESSAGE_EVENT
}
