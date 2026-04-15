import { vi, describe, beforeEach, test, expect } from 'vitest'

const mockUpdateOne = vi.fn()
const mockSaveCloudEvent = vi.fn()
const mockGetEventSummary = vi.fn()
const mockGetStatusFromTypeSuffix = vi.fn()

vi.mock('../../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

vi.mock('../../../../src/common/helpers/mongodb.js', () => ({
  getMongoDb: () => ({
    collections: {
      payments: { updateOne: mockUpdateOne }
    }
  })
}))

vi.mock('../../../../src/events/save/cloud-events.js', () => ({
  saveCloudEvent: mockSaveCloudEvent,
  getEventSummary: mockGetEventSummary,
  getStatusFromTypeSuffix: mockGetStatusFromTypeSuffix
}))

vi.mock('../../../../src/config/config.js', () => ({
  config: { get: vi.fn().mockReturnValue(5000) }
}))

const { save } = await import('../../../../src/events/save/payment.js')

const mockEventEntity = {
  _id: 'ffc-pay-enrichment:850e8400-e29b-41d4-a716-446655440002',
  id: '850e8400-e29b-41d4-a716-446655440002',
  source: 'ffc-pay-enrichment',
  type: 'uk.gov.defra.ffc.pay.payment.enriched',
  time: '2023-10-17T14:46:01.000Z',
  received: new Date('2023-10-17T14:46:01.500Z')
}

const enrichedEvent = {
  type: 'uk.gov.defra.ffc.pay.payment.enriched',
  time: '2023-10-17T14:46:01.000Z',
  data: {
    correlationId: 'corr-id-1',
    frn: 1234567890,
    schemeId: 1,
    invoiceNumber: 'S000000010000001V001',
    value: 80000
  }
}

const acknowledgedEvent = {
  type: 'uk.gov.defra.ffc.pay.payment.acknowledged',
  time: '2023-10-17T14:49:01.000Z',
  data: {
    correlationId: 'corr-id-1',
    frn: 1234567890,
    schemeId: 1,
    invoiceNumber: 'S000000010000001V001',
    value: 80000
  }
}

describe('payment save - enriched event', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSaveCloudEvent.mockResolvedValue(mockEventEntity)
    mockUpdateOne.mockResolvedValue({})
    mockGetEventSummary.mockReturnValue({ _id: 'ffc-pay-enrichment:test', type: 'enriched' })
    mockGetStatusFromTypeSuffix.mockReturnValue('enriched')
  })

  test('should produce 8-stage pipeline for enriched events', async () => {
    await save(enrichedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    expect(pipeline).toHaveLength(8)
  })

  test('should prepend duplicate detection stage with correct fields', async () => {
    await save(enrichedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    expect(pipeline[0].$set._isDuplicateEnriched).toBeDefined()
    expect(pipeline[0].$set._originalLastUpdated).toBe('$lastUpdated')
    expect(pipeline[0].$set._originalStatus).toBe('$status')
  })

  test('duplicate detection stage matches invoiceNumber against existing paymentRequests', async () => {
    await save(enrichedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    const indexOfArray = pipeline[0].$set._isDuplicateEnriched.$gt[0].$indexOfArray
    expect(indexOfArray[0].$ifNull[0].$map.input).toBe('$paymentRequests')
    expect(indexOfArray[1]).toBe(enrichedEvent.data.invoiceNumber)
  })

  test('should include duplicate revert stage after status tracking (stage index 6)', async () => {
    await save(enrichedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    expect(pipeline[6].$set.lastUpdated).toEqual({ $cond: ['$_isDuplicateEnriched', '$_originalLastUpdated', '$lastUpdated'] })
    expect(pipeline[6].$set.lastEventTime).toEqual({ $cond: ['$_isDuplicateEnriched', '$_prevLastEventTime', '$lastEventTime'] })
    expect(pipeline[6].$set.status).toEqual({ $cond: ['$_isDuplicateEnriched', '$_originalStatus', '$status'] })
  })

  test('paymentRequests stage guards update behind duplicate flag', async () => {
    await save(enrichedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    // Stage index 2 is beforeEventTracking (after prependStages + Stage 1)
    const paymentRequestsValue = pipeline[2].$set.paymentRequests
    expect(paymentRequestsValue).toMatchObject({ $cond: ['$_isDuplicateEnriched', '$paymentRequests', expect.anything()] })
  })

  test('cleanup stage includes enriched-specific temporary fields', async () => {
    await save(enrichedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    const unsetStage = pipeline[pipeline.length - 1]
    expect(unsetStage.$unset).toContain('_isDuplicateEnriched')
    expect(unsetStage.$unset).toContain('_originalLastUpdated')
    expect(unsetStage.$unset).toContain('_originalStatus')
  })
})

describe('payment save - non-enriched event', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSaveCloudEvent.mockResolvedValue(mockEventEntity)
    mockUpdateOne.mockResolvedValue({})
    mockGetEventSummary.mockReturnValue({ _id: 'ffc-pay-responses:test', type: 'acknowledged' })
    mockGetStatusFromTypeSuffix.mockReturnValue('acknowledged')
  })

  test('should produce 6-stage pipeline for non-enriched events', async () => {
    await save(acknowledgedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    expect(pipeline).toHaveLength(6)
  })

  test('should not prepend duplicate detection stage', async () => {
    await save(acknowledgedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    // Stage 0 should be the data $set (Stage 1 of builder), not duplicate detection
    expect(pipeline[0].$set._isDuplicateEnriched).toBeUndefined()
    expect(pipeline[0].$set._incomingTime).toBeDefined()
  })

  test('cleanup stage does not include enriched-specific temporary fields', async () => {
    await save(acknowledgedEvent)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    const unsetStage = pipeline[pipeline.length - 1]
    expect(unsetStage.$unset).not.toContain('_isDuplicateEnriched')
    expect(unsetStage.$unset).not.toContain('_originalLastUpdated')
    expect(unsetStage.$unset).not.toContain('_originalStatus')
  })
})

describe('payment save - extracted event (pence conversion)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSaveCloudEvent.mockResolvedValue(mockEventEntity)
    mockUpdateOne.mockResolvedValue({})
    mockGetEventSummary.mockReturnValue({ _id: 'ffc-pay-batch-processor:test', type: 'extracted' })
    mockGetStatusFromTypeSuffix.mockReturnValue('extracted')
  })

  test('should convert value from pounds to pence for extracted events', async () => {
    const event = {
      type: 'uk.gov.defra.ffc.pay.payment.extracted',
      time: '2023-10-17T14:45:01.000Z',
      data: {
        correlationId: 'corr-id-1',
        frn: 1234567890,
        schemeId: 1,
        invoiceNumber: 'SFI0001234V001',
        value: 800 // 800 pounds → should become 80000 pence
      }
    }

    await save(event)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    // pipeline[0] = Stage 1 (no prependStages for extracted); pipeline[1] = beforeEventTracking
    expect(pipeline[1].$set._incomingPaymentRequest.value).toBe(80000)
  })

  test('should convert invoiceLines values from pounds to pence for extracted events', async () => {
    const event = {
      type: 'uk.gov.defra.ffc.pay.payment.extracted',
      time: '2023-10-17T14:45:01.000Z',
      data: {
        correlationId: 'corr-id-1',
        frn: 1234567890,
        schemeId: 1,
        invoiceNumber: 'SFI0001234V001',
        value: 800,
        invoiceLines: [
          { description: 'G00', value: 1000 }, // 1000 pounds → 100000 pence
          { description: 'P24', value: -200 }  // -200 pounds → -20000 pence
        ]
      }
    }

    await save(event)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    const lines = pipeline[1].$set._incomingPaymentRequest.invoiceLines
    expect(lines[0].value).toBe(100000)
    expect(lines[1].value).toBe(-20000)
  })

  test('should not convert values for non-extracted events', async () => {
    const event = {
      type: 'uk.gov.defra.ffc.pay.payment.processed',
      time: '2023-10-17T14:47:01.000Z',
      data: {
        correlationId: 'corr-id-1',
        frn: 1234567890,
        schemeId: 1,
        invoiceNumber: 'S000000010000001V001',
        value: 80000 // already in pence, must not be converted again
      }
    }

    await save(event)

    const pipeline = mockUpdateOne.mock.calls[0][1]
    expect(pipeline[1].$set._incomingPaymentRequest.value).toBe(80000)
  })
})

describe('payment save - event not saved', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSaveCloudEvent.mockResolvedValue(null)
    mockUpdateOne.mockResolvedValue({})
  })

  test('should not upsert payment if saveCloudEvent returns null', async () => {
    await save(enrichedEvent)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })
})
