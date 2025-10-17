export function getEventType (type) {
  if (type.startsWith('uk.gov.fcp.sfd.notification')) {
    return 'message'
  } else {
    const error = new Error(`Unknown event type: ${type}`)
    error.category = 'validation'
    throw error
  }
}
