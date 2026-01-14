import * as events from '../mocks/events.js'

export const singleEvents = {
  // Message events
  messageRequest: [events.messageRequest],
  messageValidationFailure: [events.messageValidationFailure],
  messageSending: [events.messageSending],
  messageDelivered: [events.messageDelivered],
  messageProviderFailure: [events.messageProviderFailure],
  messageInternalFailure: [events.messageInternalFailure],
  messageRetryRequest: [events.messageRetryRequest],
  messageRetryExpired: [events.messageRetryExpired],

  // Document events
  documentUploaded: [events.documentUpload],
  documentDeleted: [events.documentDeleted],

  // CRM events
  crmCaseCreated: [events.crmCaseCreated],
  crmCaseUpdated: [events.crmCaseUpdated]
}

export const completeStreams = {
  /**
   * Message Happy Path: Message request → Sending → Delivered
   */
  successful: [
    events.messageRequest,
    events.messageSending,
    events.messageDelivered
  ],

  /**
   * Message Validation Failure Path: Message request fails validation immediately
   */
  validationFailure: [
    events.messageRequest,
    events.messageValidationFailure
  ],

  /**
   * Message Provider Failure Path: Message request → Sending → Provider failure
   */
  providerFailure: [
    events.messageRequest,
    events.messageSending,
    events.messageProviderFailure
  ],

  /**
   * Message Internal Failure Path: Message request → Internal failure
   */
  internalFailure: [
    events.messageRequest,
    events.messageInternalFailure
  ],

  /**
   * Message Retry Success Path: Message request → Internal failure → Retry → Sending → Delivered
   */
  retrySuccess: [
    events.messageRequest,
    events.messageInternalFailure,
    events.messageRetryRequest,
    events.messageSending,
    events.messageDelivered
  ],

  /**
   * Message Retry Failure Path: Message request → Failure → Retry → Failure → Retry expired
   */
  retryFailure: [
    events.messageRequest,
    events.messageInternalFailure,
    events.messageRetryRequest,
    { ...events.messageInternalFailure, id: '550e8400-e29b-41d4-a716-446655440099', time: '2023-10-17T14:52:00.000Z' },
    events.messageRetryExpired
  ],

  /**
   * Document uploaded and deleted
   */
  documentUploadedAndDeleted: [
    events.documentUpload,
    events.documentDeleted
  ],

  /**
   * CRM case created and updated
   */
  crmCaseCreatedAndUpdated: [
    events.crmCaseCreated,
    events.crmCaseUpdated
  ]
}

export const scenarios = {
  single: singleEvents,
  streams: completeStreams
}

export function getScenario (path) {
  const parts = path.split('.')
  let current = scenarios

  for (const part of parts) {
    if (current[part]) {
      current = current[part]
    } else {
      throw new Error(`Scenario not found: ${path}`)
    }
  }

  return current
}

export function listScenarios () {
  const list = []

  function traverse (obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key
      if (Array.isArray(value)) {
        list.push({
          path: currentPath,
          count: value.length
        })
      } else if (typeof value === 'object') {
        traverse(value, currentPath)
      } else {
        list.push({
          path: currentPath,
          count: 1
        })
      }
    }
  }

  traverse(scenarios)
  return list
}
