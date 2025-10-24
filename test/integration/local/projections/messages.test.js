import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../src/config/config.js'
import { getMessages, getMessageByCorrelationId } from '../../../../src/projections/messages.js'
import { clearAllCollections } from '../../../helpers/mongo.js'

const CORRELATION_ID_1 = '00000000-0000-0000-0000-000000000001'
const CORRELATION_ID_2 = '00000000-0000-0000-0000-000000000002'
const CORRELATION_ID_3 = '00000000-0000-0000-0000-000000000003'
const CORRELATION_ID_4 = '00000000-0000-0000-0000-000000000004'

const testMessages = [{
  _id: CORRELATION_ID_1,
  crn: 1234567890,
  sbi: 987654321,
  recipient: 'user1@example.com',
  subject: 'Test Message 1',
  body: 'This is the body of test message 1.',
  status: 'received',
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T10:05:00Z'),
  events: [{
    _id: `source1:${CORRELATION_ID_1}`,
    type: 'uk.gov.fcp.sfd.notification.received'
  }]
}, {
  _id: CORRELATION_ID_2,
  crn: 1234567890, // Same CRN as message 1
  sbi: 987654322,  // Different SBI
  recipient: 'user2@example.com',
  subject: 'Test Message 2',
  body: 'This is the body of test message 2.',
  status: 'sending',
  created: new Date('2024-01-01T11:00:00Z'),
  lastUpdated: new Date('2024-01-01T11:05:00Z'),
  events: [{
    _id: `source1:${CORRELATION_ID_2}`,
    type: 'uk.gov.fcp.sfd.notification.sending'
  }]
}, {
  _id: CORRELATION_ID_3,
  crn: 1234567891, // Different CRN
  sbi: 987654321,  // Same SBI as message 1
  recipient: 'user3@example.com',
  subject: 'Test Message 3',
  body: 'This is the body of test message 3.',
  status: 'delivered',
  created: new Date('2024-01-01T12:00:00Z'),
  lastUpdated: new Date('2024-01-01T12:05:00Z'),
  events: [{
    _id: `source1:${CORRELATION_ID_3}`,
    type: 'uk.gov.fcp.sfd.notification.delivered'
  }]
}, {
  _id: CORRELATION_ID_4,
  crn: 1234567891, // Same CRN as message 3
  sbi: 987654323,  // Different SBI from all others
  recipient: 'user4@example.com',
  subject: 'Test Message 4',
  body: 'This is the body of test message 4.',
  status: 'failure.provider',
  created: new Date('2024-01-01T13:00:00Z'),
  lastUpdated: new Date('2024-01-01T13:05:00Z'),
  events: [{
    _id: `source1:${CORRELATION_ID_4}`,
    type: 'uk.gov.fcp.sfd.notification.failure.provider'
  }]
}]

const createBaseMessage = (message) => ({
  correlationId: message._id,
  crn: message.crn,
  sbi: message.sbi,
  status: message.status,
  created: message.created,
  lastUpdated: message.lastUpdated
})

const createMessageWithContent = (message) => ({
  ...createBaseMessage(message),
  recipient: message.recipient,
  subject: message.subject,
  body: message.body
})

const createMessageWithEvents = (message) => ({
  ...createBaseMessage(message),
  events: message.events.map(({ _id, ...event }) => event) // Remove _id from events
})

const createFullMessage = (message) => ({
  ...createMessageWithContent(message),
  events: message.events.map(({ _id, ...event }) => event) // Remove _id from events
})

let db
let collections

beforeAll(async () => {
  await createMongoDbConnection(config.get('mongo'))

  const mongoDb = getMongoDb()
  db = mongoDb.db
  collections = mongoDb.collections
})

beforeEach(async () => {
  await clearAllCollections(db, collections)
  await db.collection(collections.messages).insertMany(testMessages)
})

afterAll(async () => {
  await closeMongoDbConnection()
})

describe('getMessages', () => {
  test('should retrieve all messages without content and events', async () => {
    const messages = await getMessages()
    expect(messages).toEqual(testMessages.map(createBaseMessage))
    expect(messages).toHaveLength(4)
  })

  test('should filter messages by CRN if requested - multiple results', async () => {
    const crn = 1234567890
    const expectedMessages = testMessages.filter(msg => msg.crn === crn)
    const messages = await getMessages({ crn })
    expect(messages).toEqual(expectedMessages.map(createBaseMessage))
    expect(messages).toHaveLength(2)
  })

  test('should filter messages by CRN if requested - single result', async () => {
    const crn = 1234567891
    const expectedMessages = testMessages.filter(msg => msg.crn === crn)
    const messages = await getMessages({ crn })
    expect(messages).toEqual(expectedMessages.map(createBaseMessage))
    expect(messages).toHaveLength(2)
  })

  test('should filter messages by SBI if requested - multiple results', async () => {
    const sbi = 987654321
    const expectedMessages = testMessages.filter(msg => msg.sbi === sbi)
    const messages = await getMessages({ sbi })
    expect(messages).toEqual(expectedMessages.map(createBaseMessage))
    expect(messages).toHaveLength(2)
  })

  test('should filter messages by SBI if requested - single result', async () => {
    const sbi = 987654322
    const expectedMessages = testMessages.filter(msg => msg.sbi === sbi)
    const messages = await getMessages({ sbi })
    expect(messages).toEqual(expectedMessages.map(createBaseMessage))
    expect(messages).toHaveLength(1)
  })

  test('should filter messages by CRN and SBI if requested - single match', async () => {
    const crn = 1234567890
    const sbi = 987654321
    const expectedMessages = testMessages.filter(msg => msg.crn === crn && msg.sbi === sbi)
    const messages = await getMessages({ crn, sbi })
    expect(messages).toEqual(expectedMessages.map(createBaseMessage))
    expect(messages).toHaveLength(1)
  })

  test('should filter messages by CRN and SBI if requested - no matches', async () => {
    const messages = await getMessages({ crn: 1234567890, sbi: 987654323 })
    expect(messages).toEqual([]) // No message has this combination
    expect(messages).toHaveLength(0)
  })

  test('should include content if requested', async () => {
    const messages = await getMessages({ includeContent: true })
    expect(messages).toEqual(testMessages.map(createMessageWithContent))
    expect(messages).toHaveLength(4)
  })

  test('should include events if requested', async () => {
    const messages = await getMessages({ includeEvents: true })
    expect(messages).toEqual(testMessages.map(createMessageWithEvents))
    expect(messages).toHaveLength(4)
  })

  test('should include both content and events if requested', async () => {
    const messages = await getMessages({ includeContent: true, includeEvents: true })
    expect(messages).toEqual(testMessages.map(createFullMessage))
    expect(messages).toHaveLength(4)
  })

  test('should combine filtering with content inclusion', async () => {
    const crn = 1234567890
    const expectedMessages = testMessages.filter(msg => msg.crn === crn)
    const messages = await getMessages({ crn, includeContent: true })
    expect(messages).toEqual(expectedMessages.map(createMessageWithContent))
    expect(messages).toHaveLength(2)
  })

  test('should return empty array when no messages match filter', async () => {
    const messages = await getMessages({ crn: 9999999999 })
    expect(messages).toEqual([])
    expect(messages).toHaveLength(0)
  })
})

describe('getMessageByCorrelationId', () => {
  test('should retrieve message by correlation ID without content and events', async () => {
    const message = await getMessageByCorrelationId(CORRELATION_ID_1)
    expect(message).toEqual(createBaseMessage(testMessages[0]))
  })

  test('should retrieve message with content when requested', async () => {
    const message = await getMessageByCorrelationId(CORRELATION_ID_1, { includeContent: true })
    expect(message).toEqual(createMessageWithContent(testMessages[0]))
  })

  test('should retrieve message with events when requested', async () => {
    const message = await getMessageByCorrelationId(CORRELATION_ID_1, { includeEvents: true })
    expect(message).toEqual(createMessageWithEvents(testMessages[0]))
  })

  test('should retrieve message with both content and events when requested', async () => {
    const message = await getMessageByCorrelationId(CORRELATION_ID_1, { includeContent: true, includeEvents: true })
    expect(message).toEqual(createFullMessage(testMessages[0]))
  })

  test('should return null for non-existent correlation ID', async () => {
    const message = await getMessageByCorrelationId('non-existent-id')
    expect(message).toBeNull()
  })

  test('should retrieve second message correctly', async () => {
    const message = await getMessageByCorrelationId(CORRELATION_ID_2)
    expect(message).toEqual(createBaseMessage(testMessages[1]))
  })

  test('should handle options with false values correctly', async () => {
    const message = await getMessageByCorrelationId(CORRELATION_ID_1, { includeContent: false, includeEvents: false })
    expect(message).toEqual(createBaseMessage(testMessages[0]))
  })
})
