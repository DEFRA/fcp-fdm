import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../src/config/config.js'
import { getPayments, getPaymentByCorrelationId } from '../../../../src/projections/payment.js'
import { clearAllCollections } from '../../../helpers/mongo.js'

const CORRELATION_ID_1 = '00000000-0000-0000-0000-000000000001'
const CORRELATION_ID_2 = '00000000-0000-0000-0000-000000000002'
const CORRELATION_ID_3 = '00000000-0000-0000-0000-000000000003'
const CORRELATION_ID_4 = '00000000-0000-0000-0000-000000000004'

const testPayments = [{
  _id: CORRELATION_ID_1,
  frn: 1234567890,
  sbi: 987654321,
  schemeId: 1,
  scheme: 'SFI',
  vendor: 'VENDOR-A',
  trader: 'TRADER-X',
  invoiceNumber: 'INV-001',
  paymentRequests: [{
    invoiceNumber: 'INV-001',
    value: 100000,
    time: new Date('2024-01-01T10:00:00Z')
  }],
  status: 'pending',
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T10:05:00Z'),
  events: [{
    _id: `source1:${CORRELATION_ID_1}`,
    type: 'uk.gov.fcp.sfd.payment.pending'
  }]
}, {
  _id: CORRELATION_ID_2,
  frn: 1234567890, // Same FRN as payment 1
  sbi: 987654322,  // Different SBI
  schemeId: 1,     // Same scheme
  scheme: 'SFI',   // Same scheme name
  vendor: 'VENDOR-B',
  trader: 'TRADER-X', // Same trader
  invoiceNumber: 'INV-002',
  paymentRequests: [{
    invoiceNumber: 'INV-002',
    value: 200000,
    invoiceLines: [{
      description: 'Payment line 1',
      value: 200000
    }],
    time: new Date('2024-01-01T11:00:00Z')
  }],
  status: 'processing',
  created: new Date('2024-01-01T11:00:00Z'),
  lastUpdated: new Date('2024-01-01T11:05:00Z'),
  events: [{
    _id: `source1:${CORRELATION_ID_2}`,
    type: 'uk.gov.fcp.sfd.payment.processing'
  }]
}, {
  _id: CORRELATION_ID_3,
  frn: 1234567891, // Different FRN
  sbi: 987654321,  // Same SBI as payment 1
  schemeId: 2,     // Different scheme
  scheme: 'CS',    // Different scheme name
  vendor: 'VENDOR-A', // Same vendor as payment 1
  trader: 'TRADER-Y',
  invoiceNumber: 'INV-003',
  paymentRequests: [{
    invoiceNumber: 'INV-003',
    value: 300000,
    time: new Date('2024-01-01T12:00:00Z')
  }],
  status: 'completed',
  created: new Date('2024-01-01T12:00:00Z'),
  lastUpdated: new Date('2024-01-01T12:05:00Z'),
  events: [{
    _id: `source1:${CORRELATION_ID_3}`,
    type: 'uk.gov.fcp.sfd.payment.completed'
  }]
}, {
  _id: CORRELATION_ID_4,
  frn: 1234567891, // Same FRN as payment 3
  sbi: 987654323,  // Different SBI from all others
  schemeId: 2,     // Same scheme as payment 3
  scheme: 'CS',    // Same scheme name as payment 3
  vendor: 'VENDOR-B', // Same vendor as payment 2
  trader: 'TRADER-Y', // Same trader as payment 3
  invoiceNumber: 'INV-004',
  paymentRequests: [{
    invoiceNumber: 'INV-004-A',
    value: 150000,
    time: new Date('2024-01-01T13:00:00Z')
  }, {
    invoiceNumber: 'INV-004-B',
    value: 250000,
    time: new Date('2024-01-01T13:02:00Z')
  }],
  status: 'failed',
  created: new Date('2024-01-01T13:00:00Z'),
  lastUpdated: new Date('2024-01-01T13:05:00Z'),
  events: [{
    _id: `source1:${CORRELATION_ID_4}`,
    type: 'uk.gov.fcp.sfd.payment.failed'
  }]
}]

const createBasePayment = (payment) => ({
  correlationId: payment._id,
  frn: payment.frn,
  sbi: payment.sbi,
  schemeId: payment.schemeId,
  vendor: payment.vendor,
  trader: payment.trader,
  invoiceNumber: payment.invoiceNumber,
  paymentRequests: payment.paymentRequests,
  status: payment.status,
  created: payment.created,
  lastUpdated: payment.lastUpdated
})

const createPaymentWithEvents = (payment) => ({
  ...createBasePayment(payment),
  events: payment.events.map(({ _id, ...event }) => event) // Remove _id from events
})

let collections

beforeAll(async () => {
  await createMongoDbConnection(config.get('mongo'))

  const mongoDb = getMongoDb()
  collections = mongoDb.collections
})

beforeEach(async () => {
  await clearAllCollections(collections)
  await collections.payments.insertMany(testPayments)
})

afterAll(async () => {
  await closeMongoDbConnection()
})

describe('getPayments', () => {
  test('should retrieve all payments without events', async () => {
    const { payments } = await getPayments()
    expect(payments).toEqual(expect.arrayContaining(testPayments.map(createBasePayment)))
    expect(payments).toHaveLength(4)
  })

  test('should filter payments by FRN if requested - multiple results', async () => {
    const frn = 1234567890
    const expectedPayments = testPayments.filter(payment => payment.frn === frn)
    const { payments } = await getPayments({ frn })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by FRN if requested - single result', async () => {
    const frn = 1234567891
    const expectedPayments = testPayments.filter(payment => payment.frn === frn)
    const { payments } = await getPayments({ frn })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by SBI if requested - multiple results', async () => {
    const sbi = 987654321
    const expectedPayments = testPayments.filter(payment => payment.sbi === sbi)
    const { payments } = await getPayments({ sbi })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by SBI if requested - single result', async () => {
    const sbi = 987654322
    const expectedPayments = testPayments.filter(payment => payment.sbi === sbi)
    const { payments } = await getPayments({ sbi })
    expect(payments).toEqual(expectedPayments.map(createBasePayment))
    expect(payments).toHaveLength(1)
  })

  test('should filter payments by schemeId if requested - multiple results', async () => {
    const schemeId = 1
    const expectedPayments = testPayments.filter(payment => payment.schemeId === schemeId)
    const { payments } = await getPayments({ schemeId })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by schemeId if requested - single result', async () => {
    const schemeId = 2
    const expectedPayments = testPayments.filter(payment => payment.schemeId === schemeId)
    const { payments } = await getPayments({ schemeId })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by scheme if requested - multiple results', async () => {
    const scheme = 'SFI'
    const expectedPayments = testPayments.filter(payment => payment.scheme === scheme)
    const { payments } = await getPayments({ scheme })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by scheme if requested - single result', async () => {
    const scheme = 'CS'
    const expectedPayments = testPayments.filter(payment => payment.scheme === scheme)
    const { payments } = await getPayments({ scheme })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by vendor if requested - multiple results', async () => {
    const vendor = 'VENDOR-A'
    const expectedPayments = testPayments.filter(payment => payment.vendor === vendor)
    const { payments } = await getPayments({ vendor })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by vendor if requested - single result', async () => {
    const vendor = 'VENDOR-B'
    const expectedPayments = testPayments.filter(payment => payment.vendor === vendor)
    const { payments } = await getPayments({ vendor })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by trader if requested - multiple results', async () => {
    const trader = 'TRADER-X'
    const expectedPayments = testPayments.filter(payment => payment.trader === trader)
    const { payments } = await getPayments({ trader })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by trader if requested - single result', async () => {
    const trader = 'TRADER-Y'
    const expectedPayments = testPayments.filter(payment => payment.trader === trader)
    const { payments } = await getPayments({ trader })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should filter payments by FRN and SBI if requested - single match', async () => {
    const frn = 1234567890
    const sbi = 987654321
    const expectedPayments = testPayments.filter(payment => payment.frn === frn && payment.sbi === sbi)
    const { payments } = await getPayments({ frn, sbi })
    expect(payments).toEqual(expectedPayments.map(createBasePayment))
    expect(payments).toHaveLength(1)
  })

  test('should filter payments by FRN and SBI if requested - no matches', async () => {
    const { payments } = await getPayments({ frn: 1234567890, sbi: 987654323 })
    expect(payments).toEqual([]) // No payment has this combination
    expect(payments).toHaveLength(0)
  })

  test('should filter payments by schemeId and vendor if requested', async () => {
    const schemeId = 1
    const vendor = 'VENDOR-A'
    const expectedPayments = testPayments.filter(payment => payment.schemeId === schemeId && payment.vendor === vendor)
    const { payments } = await getPayments({ schemeId, vendor })
    expect(payments).toEqual(expectedPayments.map(createBasePayment))
    expect(payments).toHaveLength(1)
  })

  test('should filter payments by multiple criteria', async () => {
    const frn = 1234567890
    const schemeId = 1
    const trader = 'TRADER-X'
    const expectedPayments = testPayments.filter(payment =>
      payment.frn === frn && payment.schemeId === schemeId && payment.trader === trader
    )
    const { payments } = await getPayments({ frn, schemeId, trader })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createBasePayment)))
    expect(payments).toHaveLength(2)
  })

  test('should include events if requested', async () => {
    const { payments } = await getPayments({ includeEvents: true })
    expect(payments).toEqual(expect.arrayContaining(testPayments.map(createPaymentWithEvents)))
    expect(payments).toHaveLength(4)
  })

  test('should combine filtering with events inclusion', async () => {
    const frn = 1234567890
    const expectedPayments = testPayments.filter(payment => payment.frn === frn)
    const { payments } = await getPayments({ frn, includeEvents: true })
    expect(payments).toEqual(expect.arrayContaining(expectedPayments.map(createPaymentWithEvents)))
    expect(payments).toHaveLength(2)
  })

  test('should return empty array when no payments match filter', async () => {
    const { payments } = await getPayments({ frn: 9999999999 })
    expect(payments).toEqual([])
    expect(payments).toHaveLength(0)
  })

  test('should return payments in descending order of created by default', async () => {
    const { payments } = await getPayments()
    const sorted = [...payments].sort((a, b) => b.created - a.created)
    expect(payments).toEqual(sorted)
  })

  test('should return only the first page of results with custom pageSize', async () => {
    const sorted = [...testPayments].sort((a, b) => b.created - a.created)
    const { payments } = await getPayments({ page: 1, pageSize: 2 })
    expect(payments).toEqual([
      createBasePayment(sorted[0]),
      createBasePayment(sorted[1])
    ])
    expect(payments).toHaveLength(2)
  })

  test('should return the second page of results with custom pageSize', async () => {
    const sorted = [...testPayments].sort((a, b) => b.created - a.created)
    const { payments } = await getPayments({ page: 2, pageSize: 2 })
    expect(payments).toEqual([
      createBasePayment(sorted[2]),
      createBasePayment(sorted[3])
    ])
    expect(payments).toHaveLength(2)
  })

  test('should explicitly order payments by created descending', async () => {
    const { payments } = await getPayments()
    for (let i = 0; i < payments.length - 1; i++) {
      expect(payments[i].created >= payments[i + 1].created).toBe(true)
    }
  })
})

describe('getPaymentByCorrelationId', () => {
  test('should retrieve payment by correlation ID without events', async () => {
    const payment = await getPaymentByCorrelationId(CORRELATION_ID_1)
    expect(payment).toEqual(createBasePayment(testPayments[0]))
  })

  test('should retrieve payment with events when requested', async () => {
    const payment = await getPaymentByCorrelationId(CORRELATION_ID_1, { includeEvents: true })
    expect(payment).toEqual(createPaymentWithEvents(testPayments[0]))
  })

  test('should return null for non-existent correlation ID', async () => {
    const payment = await getPaymentByCorrelationId('non-existent-id')
    expect(payment).toBeNull()
  })

  test('should retrieve second payment correctly', async () => {
    const payment = await getPaymentByCorrelationId(CORRELATION_ID_2)
    expect(payment).toEqual(createBasePayment(testPayments[1]))
  })

  test('should handle options with false values correctly', async () => {
    const payment = await getPaymentByCorrelationId(CORRELATION_ID_1, { includeEvents: false })
    expect(payment).toEqual(createBasePayment(testPayments[0]))
  })

  test('should retrieve all payment fields correctly', async () => {
    const payment = await getPaymentByCorrelationId(CORRELATION_ID_3)
    expect(payment).toMatchObject({
      correlationId: CORRELATION_ID_3,
      frn: 1234567891,
      sbi: 987654321,
      schemeId: 2,
      vendor: 'VENDOR-A',
      trader: 'TRADER-Y',
      invoiceNumber: 'INV-003',
      status: 'completed'
    })
  })

  test('should include paymentRequests array in payment response', async () => {
    const payment = await getPaymentByCorrelationId(CORRELATION_ID_1)
    expect(payment.paymentRequests).toBeDefined()
    expect(payment.paymentRequests).toHaveLength(1)
    expect(payment.paymentRequests[0]).toMatchObject({
      invoiceNumber: 'INV-001',
      value: 100000
    })
  })

  test('should include paymentRequests with invoice lines when present', async () => {
    const payment = await getPaymentByCorrelationId(CORRELATION_ID_2)
    expect(payment.paymentRequests).toBeDefined()
    expect(payment.paymentRequests).toHaveLength(1)
    expect(payment.paymentRequests[0].invoiceLines).toBeDefined()
    expect(payment.paymentRequests[0].invoiceLines).toHaveLength(1)
    expect(payment.paymentRequests[0].invoiceLines[0]).toMatchObject({
      description: 'Payment line 1',
      value: 200000
    })
  })

  test('should include multiple paymentRequests when present', async () => {
    const payment = await getPaymentByCorrelationId(CORRELATION_ID_4)
    expect(payment.paymentRequests).toBeDefined()
    expect(payment.paymentRequests).toHaveLength(2)
    expect(payment.paymentRequests[0].invoiceNumber).toBe('INV-004-A')
    expect(payment.paymentRequests[1].invoiceNumber).toBe('INV-004-B')
  })
})
