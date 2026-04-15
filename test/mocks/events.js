const cloudEventBase = {
  specversion: '1.0',
  datacontenttype: 'application/json'
}

const messageBase = {
  ...cloudEventBase,
  source: 'fcp-sfd-comms'
}

const documentBase = {
  ...cloudEventBase,
  source: 'fcp-sfd-object-processor'
}

const crmBase = {
  ...cloudEventBase,
  source: 'fcp-sfd-crm'
}

// Common notification data
const notificationRequestData = {
  correlationId: '79389915-7275-457a-b8ca-8bf206b2e67b',
  crn: 1234567890,
  sbi: 123456789,
  sourceSystem: 'ffc-ahwr',
  notifyTemplateId: 'f33517ff-2a88-4f6e-b855-c550268ce08a',
  commsType: 'email',
  recipient: 'farmer@example.com',
  personalisation: {
    caseNumber: 'ACC123456789',
    expectedPaymentDate: '21.11.2025',
    adminName: 'Jessica Lrrr'
  },
  reference: 'ffc-ahwr-reference-123',
  oneClickUnsubscribeUrl: 'https://unsubscribe.example.com',
  emailReplyToId: '8e222534-7f05-4972-86e3-17c5d9f894e2'
}

// Common payment data
const paymentData = {
  frn: 1234567890,
  correlationId: 'c0a80163-7b0b-4a9e-9c0e-1c9a9a9a9a9a',
  sbi: 123456789,
  schemeId: 1,
  invoiceNumber: 'S000000010000001V001',
  contractNumber: '01234567',
  batch: 'SITISFI0001_AP_202303300929301234.dat',
  paymentRequestNumber: 1,
  marketingYear: 2023,
  sourceSystem: 'SFI',
  agreementNumber: 'SIP0000000000001',
  value: 80000,
  invoiceLines: [
    {
      description: 'G00 - Gross value of payment',
      value: 100000
    },
    {
      description: 'P24 - Penalty',
      value: -20000
    }
  ]
}

export const messageRequest = {
  ...messageBase,
  id: '550e8400-e29b-41d4-a716-446655440001',
  type: 'uk.gov.fcp.sfd.notification.received',
  time: '2023-10-17T14:48:01.000Z',
  data: notificationRequestData
}

export const messageValidationFailure = {
  ...messageBase,
  id: '550e8400-e29b-41d4-a716-446655440002',
  type: 'uk.gov.fcp.sfd.notification.failure.validation',
  time: '2023-10-17T14:48:01.000Z',
  data: {
    statusDetails: {
      status: 'validation-failure',
      errors: [
        {
          error: 'ValidationError',
          message: '"data.recipient" must be a valid email'
        }
      ]
    }
  }
}

export const messageSending = {
  ...messageBase,
  id: '550e8400-e29b-41d4-a716-446655440003',
  type: 'uk.gov.fcp.sfd.notification.sending',
  time: '2023-10-17T14:48:02.000Z',
  data: {
    correlationId: '79389915-7275-457a-b8ca-8bf206b2e67b',
    recipient: 'farmer@example.com',
    statusDetails: {
      status: 'sending'
    }
  }
}

export const messageDelivered = {
  ...messageBase,
  id: '550e8400-e29b-41d4-a716-446655440004',
  type: 'uk.gov.fcp.sfd.notification.delivered',
  time: '2023-10-17T14:50:00.000Z',
  data: {
    correlationId: '79389915-7275-457a-b8ca-8bf206b2e67b',
    recipient: 'farmer@example.com',
    statusDetails: {
      status: 'delivered'
    }
  }
}

export const messageProviderFailure = {
  ...messageBase,
  id: '550e8400-e29b-41d4-a716-446655440005',
  type: 'uk.gov.fcp.sfd.notification.failure.provider',
  time: '2023-10-17T14:48:05.000Z',
  data: {
    correlationId: '79389915-7275-457a-b8ca-8bf206b2e67b',
    recipient: 'farmer@example.com',
    statusDetails: {
      status: 'permanent-failure'
    }
  }
}

export const messageInternalFailure = {
  ...messageBase,
  id: '550e8400-e29b-41d4-a716-446655440006',
  type: 'uk.gov.fcp.sfd.notification.failure.internal',
  time: '2023-10-17T14:48:02.000Z',
  data: {
    correlationId: '79389915-7275-457a-b8ca-8bf206b2e67b',
    recipient: 'farmer@example.com',
    statusDetails: {
      status: 'internal-failure',
      errorCode: 400,
      errors: [
        {
          error: 'BadRequestError',
          message: "Missing personalisation key: 'caseNumber'"
        }
      ]
    }
  }
}

export const messageRetryRequest = {
  ...messageBase,
  id: '550e8400-e29b-41d4-a716-446655440007',
  type: 'uk.gov.fcp.sfd.notification.retry',
  time: '2023-10-17T15:03:00.000Z',
  data: notificationRequestData
}

export const messageRetryExpired = {
  ...messageBase,
  id: '550e8400-e29b-41d4-a716-446655440008',
  type: 'uk.gov.fcp.sfd.notification.retry.expired',
  time: '2023-10-24T14:48:00.000Z',
  data: {
    correlationId: '79389915-7275-457a-b8ca-8bf206b2e67b',
    recipient: 'farmer@example.com'
  }
}

export const documentUpload = {
  ...documentBase,
  id: '650e8400-e29b-41d4-a716-446655440001',
  type: 'uk.gov.fcp.sfd.document.uploaded',
  time: '2023-10-17T14:48:01.000Z',
  data: {
    correlationId: '89389915-7275-457a-b8ca-8bf206b2e67b',
    crn: 1234567890,
    sbi: 123456789,
    file: {
      fileId: 'file-123',
      fileName: 'document.pdf',
      contentType: 'application/pdf',
      url: 'https://example.com/document.pdf'
    }
  }
}

export const documentDeleted = {
  ...documentBase,
  id: '650e8400-e29b-41d4-a716-446655440002',
  type: 'uk.gov.fcp.sfd.document.deleted',
  time: '2023-10-17T14:50:01.000Z',
  data: {
    correlationId: '89389915-7275-457a-b8ca-8bf206b2e67b',
    crn: 1234567890,
    sbi: 123456789,
    file: {
      fileId: 'file-123',
      fileName: 'document.pdf',
      contentType: 'application/pdf',
      url: 'https://example.com/document.pdf'
    }
  }
}

export const crmCaseCreated = {
  ...crmBase,
  id: '750e8400-e29b-41d4-a716-446655440001',
  type: 'uk.gov.fcp.sfd.crm.case.created',
  time: '2023-10-17T14:48:01.000Z',
  data: {
    correlationId: '99389915-7275-457a-b8ca-8bf206b2e67b',
    crn: 1234567890,
    sbi: 123456789,
    caseId: 'case-123',
    caseType: 'DOCUMENT_UPLOAD',
    onlineSubmissionActivities: [
      {
        id: 'ols-activity-001',
        fileId: 'file-001',
        time: '2023-10-17T14:48:00.000Z'
      }
    ]
  }
}

export const crmCaseUpdated = {
  ...crmBase,
  id: '750e8400-e29b-41d4-a716-446655440002',
  type: 'uk.gov.fcp.sfd.crm.case.updated',
  time: '2023-10-17T14:50:01.000Z',
  data: {
    correlationId: '99389915-7275-457a-b8ca-8bf206b2e67b',
    crn: 1234567890,
    sbi: 123456789,
    caseId: 'case-123',
    caseType: 'DOCUMENT_UPLOAD',
    onlineSubmissionActivities: [
      {
        id: 'ols-activity-001',
        fileId: 'file-002',
        time: '2023-10-17T14:48:00.000Z'
      }
    ]
  }
}

export const paymentExtracted = {
  ...cloudEventBase,
  id: '850e8400-e29b-41d4-a716-446655440001',
  source: 'ffc-pay-batch-processor',
  type: 'uk.gov.defra.ffc.pay.payment.extracted',
  time: '2023-10-17T14:45:01.000Z',
  data: {
    ...paymentData,
    invoiceNumber: 'SFI0001234V001'
  }
}

export const paymentEnriched = {
  ...cloudEventBase,
  id: '850e8400-e29b-41d4-a716-446655440002',
  source: 'ffc-pay-enrichment',
  type: 'uk.gov.defra.ffc.pay.payment.enriched',
  time: '2023-10-17T14:46:01.000Z',
  data: paymentData
}

export const paymentProcessed = {
  ...cloudEventBase,
  id: '850e8400-e29b-41d4-a716-446655440003',
  source: 'ffc-pay-processing',
  type: 'uk.gov.defra.ffc.pay.payment.processed',
  time: '2023-10-17T14:47:01.000Z',
  data: paymentData
}

export const paymentSubmitted = {
  ...cloudEventBase,
  id: '850e8400-e29b-41d4-a716-446655440004',
  source: 'ffc-pay-submission',
  type: 'uk.gov.defra.ffc.pay.payment.submitted',
  time: '2023-10-17T14:48:01.000Z',
  data: paymentData
}

export const paymentAcknowledged = {
  ...cloudEventBase,
  id: '850e8400-e29b-41d4-a716-446655440005',
  source: 'ffc-pay-responses',
  type: 'uk.gov.defra.ffc.pay.payment.acknowledged',
  time: '2023-10-17T14:49:01.000Z',
  data: paymentData
}

export const paymentEnrichedDuplicate = {
  ...cloudEventBase,
  id: '850e8400-e29b-41d4-a716-446655440006',
  source: 'ffc-pay-enrichment',
  type: 'uk.gov.defra.ffc.pay.payment.enriched',
  time: '2023-10-17T14:50:01.000Z',
  data: paymentData
}
