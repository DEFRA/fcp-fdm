export function getEventType (type) {
  if (type === MESSAGE_EVENT_REJECTED_PREFIX) {
    return MESSAGE_EVENT_REJECTED
  }

  if (type.startsWith(MESSAGE_EVENT_PREFIX)) {
    return MESSAGE_EVENT
  }

  if (type.startsWith(DOCUMENT_EVENT_PREFIX)) {
    return DOCUMENT_EVENT
  }

  if (type.startsWith(CRM_EVENT_PREFIX)) {
    return CRM_EVENT
  }

  if (type.startsWith(PAYMENT_EVENT_PREFIX)) {
    return PAYMENT_EVENT
  }

  throw new Error(`Unknown event type: ${type}`)
}

const MESSAGE_EVENT_REJECTED_PREFIX = 'uk.gov.fcp.sfd.notification.failure.validation'
const MESSAGE_EVENT_REJECTED = 'messageRejected'

const MESSAGE_EVENT_PREFIX = 'uk.gov.fcp.sfd.notification.'
const MESSAGE_EVENT = 'message'

const DOCUMENT_EVENT_PREFIX = 'uk.gov.fcp.sfd.document.'
const DOCUMENT_EVENT = 'document'

const CRM_EVENT_PREFIX = 'uk.gov.fcp.sfd.crm.'
const CRM_EVENT = 'crm'

const PAYMENT_EVENT_PREFIX = 'uk.gov.defra.ffc.pay.payment.'
const PAYMENT_EVENT = 'payment'

export const eventTypes = {
  MESSAGE_EVENT,
  MESSAGE_EVENT_REJECTED,
  DOCUMENT_EVENT,
  CRM_EVENT,
  PAYMENT_EVENT
}

export const eventTypePrefixes = {
  MESSAGE_EVENT_PREFIX,
  MESSAGE_EVENT_REJECTED_PREFIX,
  DOCUMENT_EVENT_PREFIX,
  CRM_EVENT_PREFIX,
  PAYMENT_EVENT_PREFIX
}
