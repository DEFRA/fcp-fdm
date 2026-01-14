import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../src/config/config.js'
import { getDocuments, getDocumentByFileId } from '../../../../src/projections/documents.js'
import { clearAllCollections } from '../../../helpers/mongo.js'

const FILE_ID_1 = '00000000-0000-0000-0000-000000000001'
const FILE_ID_2 = '00000000-0000-0000-0000-000000000002'
const FILE_ID_3 = '00000000-0000-0000-0000-000000000003'
const FILE_ID_4 = '00000000-0000-0000-0000-000000000004'

const testDocuments = [{
  _id: '507f1f77bcf86cd799439011',
  fileId: FILE_ID_1,
  crn: 1234567890,
  sbi: 987654321,
  status: 'received',
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T10:05:00Z'),
  events: [{
    _id: `source1:${FILE_ID_1}`,
    type: 'uk.gov.fcp.sfd.document.received'
  }]
}, {
  _id: '507f1f77bcf86cd799439012',
  fileId: FILE_ID_2,
  crn: 1234567890, // Same CRN as document 1
  sbi: 987654322,  // Different SBI
  status: 'processing',
  created: new Date('2024-01-01T11:00:00Z'),
  lastUpdated: new Date('2024-01-01T11:05:00Z'),
  events: [{
    _id: `source1:${FILE_ID_2}`,
    type: 'uk.gov.fcp.sfd.document.processing'
  }]
}, {
  _id: '507f1f77bcf86cd799439013',
  fileId: FILE_ID_3,
  crn: 1234567891, // Different CRN
  sbi: 987654321,  // Same SBI as document 1
  status: 'validated',
  created: new Date('2024-01-01T12:00:00Z'),
  lastUpdated: new Date('2024-01-01T12:05:00Z'),
  events: [{
    _id: `source1:${FILE_ID_3}`,
    type: 'uk.gov.fcp.sfd.document.validated'
  }]
}, {
  _id: '507f1f77bcf86cd799439014',
  fileId: FILE_ID_4,
  crn: 1234567891, // Same CRN as document 3
  sbi: 987654323,  // Different SBI from all others
  status: 'rejected',
  created: new Date('2024-01-01T13:00:00Z'),
  lastUpdated: new Date('2024-01-01T13:05:00Z'),
  events: [{
    _id: `source1:${FILE_ID_4}`,
    type: 'uk.gov.fcp.sfd.document.rejected'
  }]
}]

const createBaseDocument = (document) => ({
  fileId: document.fileId,
  crn: document.crn,
  sbi: document.sbi,
  status: document.status,
  created: document.created,
  lastUpdated: document.lastUpdated
})

const createDocumentWithEvents = (document) => ({
  ...createBaseDocument(document),
  events: document.events.map(({ _id, ...event }) => event) // Remove _id from events
})

let collections

beforeAll(async () => {
  await createMongoDbConnection(config.get('mongo'))

  const mongoDb = getMongoDb()
  collections = mongoDb.collections
})

beforeEach(async () => {
  await clearAllCollections(collections)
  await collections.documents.insertMany(testDocuments)
})

afterAll(async () => {
  await closeMongoDbConnection()
})

describe('getDocuments', () => {
  test('should retrieve all documents without events', async () => {
    const { documents } = await getDocuments()
    expect(documents).toEqual(expect.arrayContaining(testDocuments.map(createBaseDocument)))
    expect(documents).toHaveLength(4)
  })

  test('should filter documents by CRN if requested - multiple results', async () => {
    const crn = 1234567890
    const expectedDocuments = testDocuments.filter(doc => doc.crn === crn)
    const { documents } = await getDocuments({ crn })
    expect(documents).toEqual(expect.arrayContaining(expectedDocuments.map(createBaseDocument)))
    expect(documents).toHaveLength(2)
  })

  test('should filter documents by CRN if requested - single result', async () => {
    const crn = 1234567891
    const expectedDocuments = testDocuments.filter(doc => doc.crn === crn)
    const { documents } = await getDocuments({ crn })
    expect(documents).toEqual(expect.arrayContaining(expectedDocuments.map(createBaseDocument)))
    expect(documents).toHaveLength(2)
  })

  test('should filter documents by SBI if requested - multiple results', async () => {
    const sbi = 987654321
    const expectedDocuments = testDocuments.filter(doc => doc.sbi === sbi)
    const { documents } = await getDocuments({ sbi })
    expect(documents).toEqual(expect.arrayContaining(expectedDocuments.map(createBaseDocument)))
    expect(documents).toHaveLength(2)
  })

  test('should filter documents by SBI if requested - single result', async () => {
    const sbi = 987654322
    const expectedDocuments = testDocuments.filter(doc => doc.sbi === sbi)
    const { documents } = await getDocuments({ sbi })
    expect(documents).toEqual(expectedDocuments.map(createBaseDocument))
    expect(documents).toHaveLength(1)
  })

  test('should filter documents by CRN and SBI if requested - single match', async () => {
    const crn = 1234567890
    const sbi = 987654321
    const expectedDocuments = testDocuments.filter(doc => doc.crn === crn && doc.sbi === sbi)
    const { documents } = await getDocuments({ crn, sbi })
    expect(documents).toEqual(expectedDocuments.map(createBaseDocument))
    expect(documents).toHaveLength(1)
  })

  test('should filter documents by CRN and SBI if requested - no matches', async () => {
    const { documents } = await getDocuments({ crn: 1234567890, sbi: 987654323 })
    expect(documents).toEqual([]) // No document has this combination
    expect(documents).toHaveLength(0)
  })

  test('should include events if requested', async () => {
    const { documents } = await getDocuments({ includeEvents: true })
    expect(documents).toEqual(expect.arrayContaining(testDocuments.map(createDocumentWithEvents)))
    expect(documents).toHaveLength(4)
  })

  test('should combine filtering with events inclusion', async () => {
    const crn = 1234567890
    const expectedDocuments = testDocuments.filter(doc => doc.crn === crn)
    const { documents } = await getDocuments({ crn, includeEvents: true })
    expect(documents).toEqual(expect.arrayContaining(expectedDocuments.map(createDocumentWithEvents)))
    expect(documents).toHaveLength(2)
  })

  test('should return empty array when no documents match filter', async () => {
    const { documents } = await getDocuments({ crn: 9999999999 })
    expect(documents).toEqual([])
    expect(documents).toHaveLength(0)
  })

  test('should return documents in descending order of created by default', async () => {
    const { documents } = await getDocuments()
    const sorted = [...documents].sort((a, b) => b.created - a.created)
    expect(documents).toEqual(sorted)
  })

  test('should return only the first page of results with custom pageSize (created desc)', async () => {
    const sorted = [...testDocuments].sort((a, b) => b.created - a.created)
    const { documents } = await getDocuments({ page: 1, pageSize: 2 })
    expect(documents).toEqual([
      createBaseDocument(sorted[0]),
      createBaseDocument(sorted[1])
    ])
    expect(documents).toHaveLength(2)
  })

  test('should return the second page of results with custom pageSize (created desc)', async () => {
    const sorted = [...testDocuments].sort((a, b) => b.created - a.created)
    const { documents } = await getDocuments({ page: 2, pageSize: 2 })
    expect(documents).toEqual([
      createBaseDocument(sorted[2]),
      createBaseDocument(sorted[3])
    ])
    expect(documents).toHaveLength(2)
  })

  test('should explicitly order documents by created descending', async () => {
    const { documents } = await getDocuments()
    for (let i = 0; i < documents.length - 1; i++) {
      expect(documents[i].created >= documents[i + 1].created).toBe(true)
    }
  })
})

describe('getDocumentByFileId', () => {
  test('should retrieve document by file ID without events', async () => {
    const document = await getDocumentByFileId(FILE_ID_1)
    expect(document).toEqual(createBaseDocument(testDocuments[0]))
  })

  test('should retrieve document with events when requested', async () => {
    const document = await getDocumentByFileId(FILE_ID_1, { includeEvents: true })
    expect(document).toEqual(createDocumentWithEvents(testDocuments[0]))
  })

  test('should return null for non-existent file ID', async () => {
    const document = await getDocumentByFileId('non-existent-id')
    expect(document).toBeNull()
  })

  test('should retrieve second document correctly', async () => {
    const document = await getDocumentByFileId(FILE_ID_2)
    expect(document).toEqual(createBaseDocument(testDocuments[1]))
  })

  test('should handle options with false values correctly', async () => {
    const document = await getDocumentByFileId(FILE_ID_1, { includeEvents: false })
    expect(document).toEqual(createBaseDocument(testDocuments[0]))
  })
})
