export function getEventType (type) {
  if (type.startsWith('uk.gov.fcp.sfd.notification')) {
    return 'message'
  } else {
    throw new Error(`Unknown event type: ${type}`)
  }
}
