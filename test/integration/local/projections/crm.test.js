import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../src/config/config.js'
import { getCrmCases, getCrmByCaseId } from '../../../../src/projections/crm.js'
import { clearAllCollections } from '../../../helpers/mongo.js'

const CASE_ID_1 = '00000000-0000-0000-0000-000000000001'
const CASE_ID_2 = '00000000-0000-0000-0000-000000000002'
const CASE_ID_3 = '00000000-0000-0000-0000-000000000003'
const CASE_ID_4 = '00000000-0000-0000-0000-000000000004'

const testCrmCases = [{
  _id: '507f1f77bcf86cd799439011',
  caseId: CASE_ID_1,
  crn: 1234567890,
  sbi: 987654321,
  status: 'open',
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T10:05:00Z'),
  events: [{
    _id: `source1:${CASE_ID_1}`,
    type: 'uk.gov.fcp.sfd.crm.case.created'
  }]
}, {
  _id: '507f1f77bcf86cd799439012',
  caseId: CASE_ID_2,
  crn: 1234567890, // Same CRN as case 1
  sbi: 987654322,  // Different SBI
  status: 'in-progress',
  created: new Date('2024-01-01T11:00:00Z'),
  lastUpdated: new Date('2024-01-01T11:05:00Z'),
  events: [{
    _id: `source1:${CASE_ID_2}`,
    type: 'uk.gov.fcp.sfd.crm.case.updated'
  }]
}, {
  _id: '507f1f77bcf86cd799439013',
  caseId: CASE_ID_3,
  crn: 1234567891, // Different CRN
  sbi: 987654321,  // Same SBI as case 1
  status: 'resolved',
  created: new Date('2024-01-01T12:00:00Z'),
  lastUpdated: new Date('2024-01-01T12:05:00Z'),
  events: [{
    _id: `source1:${CASE_ID_3}`,
    type: 'uk.gov.fcp.sfd.crm.case.resolved'
  }]
}, {
  _id: '507f1f77bcf86cd799439014',
  caseId: CASE_ID_4,
  crn: 1234567891, // Same CRN as case 3
  sbi: 987654323,  // Different SBI from all others
  status: 'closed',
  created: new Date('2024-01-01T13:00:00Z'),
  lastUpdated: new Date('2024-01-01T13:05:00Z'),
  events: [{
    _id: `source1:${CASE_ID_4}`,
    type: 'uk.gov.fcp.sfd.crm.case.closed'
  }]
}]

const createBaseCrmCase = (crmCase) => ({
  caseId: crmCase.caseId,
  crn: crmCase.crn,
  sbi: crmCase.sbi,
  status: crmCase.status,
  created: crmCase.created,
  lastUpdated: crmCase.lastUpdated
})

const createCrmCaseWithEvents = (crmCase) => ({
  ...createBaseCrmCase(crmCase),
  events: crmCase.events.map(({ _id, ...event }) => event) // Remove _id from events
})

let collections

beforeAll(async () => {
  await createMongoDbConnection(config.get('mongo'))

  const mongoDb = getMongoDb()
  collections = mongoDb.collections
})

beforeEach(async () => {
  await clearAllCollections(collections)
  await collections.crm.insertMany(testCrmCases)
})

afterAll(async () => {
  await closeMongoDbConnection()
})

describe('getCrmCases', () => {
  test('should retrieve all CRM cases without events', async () => {
    const { crmCases } = await getCrmCases()
    expect(crmCases).toEqual(expect.arrayContaining(testCrmCases.map(createBaseCrmCase)))
    expect(crmCases).toHaveLength(4)
  })

  test('should filter CRM cases by CRN if requested - multiple results', async () => {
    const crn = 1234567890
    const expectedCases = testCrmCases.filter(crmCase => crmCase.crn === crn)
    const { crmCases } = await getCrmCases({ crn })
    expect(crmCases).toEqual(expect.arrayContaining(expectedCases.map(createBaseCrmCase)))
    expect(crmCases).toHaveLength(2)
  })

  test('should filter CRM cases by CRN if requested - single result', async () => {
    const crn = 1234567891
    const expectedCases = testCrmCases.filter(crmCase => crmCase.crn === crn)
    const { crmCases } = await getCrmCases({ crn })
    expect(crmCases).toEqual(expect.arrayContaining(expectedCases.map(createBaseCrmCase)))
    expect(crmCases).toHaveLength(2)
  })

  test('should filter CRM cases by SBI if requested - multiple results', async () => {
    const sbi = 987654321
    const expectedCases = testCrmCases.filter(crmCase => crmCase.sbi === sbi)
    const { crmCases } = await getCrmCases({ sbi })
    expect(crmCases).toEqual(expect.arrayContaining(expectedCases.map(createBaseCrmCase)))
    expect(crmCases).toHaveLength(2)
  })

  test('should filter CRM cases by SBI if requested - single result', async () => {
    const sbi = 987654322
    const expectedCases = testCrmCases.filter(crmCase => crmCase.sbi === sbi)
    const { crmCases } = await getCrmCases({ sbi })
    expect(crmCases).toEqual(expectedCases.map(createBaseCrmCase))
    expect(crmCases).toHaveLength(1)
  })

  test('should filter CRM cases by CRN and SBI if requested - single match', async () => {
    const crn = 1234567890
    const sbi = 987654321
    const expectedCases = testCrmCases.filter(crmCase => crmCase.crn === crn && crmCase.sbi === sbi)
    const { crmCases } = await getCrmCases({ crn, sbi })
    expect(crmCases).toEqual(expectedCases.map(createBaseCrmCase))
    expect(crmCases).toHaveLength(1)
  })

  test('should filter CRM cases by CRN and SBI if requested - no matches', async () => {
    const { crmCases } = await getCrmCases({ crn: 1234567890, sbi: 987654323 })
    expect(crmCases).toEqual([]) // No case has this combination
    expect(crmCases).toHaveLength(0)
  })

  test('should include events if requested', async () => {
    const { crmCases } = await getCrmCases({ includeEvents: true })
    expect(crmCases).toEqual(expect.arrayContaining(testCrmCases.map(createCrmCaseWithEvents)))
    expect(crmCases).toHaveLength(4)
  })

  test('should combine filtering with events inclusion', async () => {
    const crn = 1234567890
    const expectedCases = testCrmCases.filter(crmCase => crmCase.crn === crn)
    const { crmCases } = await getCrmCases({ crn, includeEvents: true })
    expect(crmCases).toEqual(expect.arrayContaining(expectedCases.map(createCrmCaseWithEvents)))
    expect(crmCases).toHaveLength(2)
  })

  test('should return empty array when no CRM cases match filter', async () => {
    const { crmCases } = await getCrmCases({ crn: 9999999999 })
    expect(crmCases).toEqual([])
    expect(crmCases).toHaveLength(0)
  })

  test('should return CRM cases in descending order of created by default', async () => {
    const { crmCases } = await getCrmCases()
    const sorted = [...crmCases].sort((a, b) => b.created - a.created)
    expect(crmCases).toEqual(sorted)
  })

  test('should return only the first page of results with custom pageSize (created desc)', async () => {
    const sorted = [...testCrmCases].sort((a, b) => b.created - a.created)
    const { crmCases } = await getCrmCases({ page: 1, pageSize: 2 })
    expect(crmCases).toEqual([
      createBaseCrmCase(sorted[0]),
      createBaseCrmCase(sorted[1])
    ])
    expect(crmCases).toHaveLength(2)
  })

  test('should return the second page of results with custom pageSize (created desc)', async () => {
    const sorted = [...testCrmCases].sort((a, b) => b.created - a.created)
    const { crmCases } = await getCrmCases({ page: 2, pageSize: 2 })
    expect(crmCases).toEqual([
      createBaseCrmCase(sorted[2]),
      createBaseCrmCase(sorted[3])
    ])
    expect(crmCases).toHaveLength(2)
  })

  test('should explicitly order CRM cases by created descending', async () => {
    const { crmCases } = await getCrmCases()
    for (let i = 0; i < crmCases.length - 1; i++) {
      expect(crmCases[i].created >= crmCases[i + 1].created).toBe(true)
    }
  })
})

describe('getCrmByCaseId', () => {
  test('should retrieve CRM case by case ID without events', async () => {
    const crmCase = await getCrmByCaseId(CASE_ID_1)
    expect(crmCase).toEqual(createBaseCrmCase(testCrmCases[0]))
  })

  test('should retrieve CRM case with events when requested', async () => {
    const crmCase = await getCrmByCaseId(CASE_ID_1, { includeEvents: true })
    expect(crmCase).toEqual(createCrmCaseWithEvents(testCrmCases[0]))
  })

  test('should return null for non-existent case ID', async () => {
    const crmCase = await getCrmByCaseId('non-existent-id')
    expect(crmCase).toBeNull()
  })

  test('should retrieve second CRM case correctly', async () => {
    const crmCase = await getCrmByCaseId(CASE_ID_2)
    expect(crmCase).toEqual(createBaseCrmCase(testCrmCases[1]))
  })

  test('should handle options with false values correctly', async () => {
    const crmCase = await getCrmByCaseId(CASE_ID_1, { includeEvents: false })
    expect(crmCase).toEqual(createBaseCrmCase(testCrmCases[0]))
  })
})
