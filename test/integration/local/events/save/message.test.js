import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../../src/config.js'
import * as messageEvents from '../../../../mocks/events.js'
import { save } from '../../../../../src/events/save/message.js'
import { clearAllCollections } from '../../../../helpers/mongo.js'
import { eventTypePrefixes } from '../../../../../src/events/types.js'

const { MESSAGE_EVENT_PREFIX } = eventTypePrefixes

let db
let collections

describe('save', () => {
  beforeAll(async () => {
    await createMongoDbConnection(config.get('mongo'))

    const mongoDb = getMongoDb()
    db = mongoDb.db
    collections = mongoDb.collections
  })

  beforeEach(async () => {
    await clearAllCollections(db, collections)
  })

  afterAll(async () => {
    await closeMongoDbConnection()
  })

  test.for(Object.keys(messageEvents))('should save event to event collection for %s with composite _id', async (eventName) => {
    const event = messageEvents[eventName]

    await save(event)

    const savedEvent = await db.collection(collections.events).findOne({ _id: `${event.source}:${event.id}` })

    expect(savedEvent).toBeDefined()
    expect(savedEvent.id).toBe(event.id)
  })

  test.for(Object.keys(messageEvents))('should save new event aggregation document for %s if first event for correlationId', async (eventName) => {
    const event = messageEvents[eventName]

    await save(event)

    const savedMessage = await db.collection(collections.messages).findOne({ _id: event.data.correlationId })

    expect(savedMessage).toBeDefined()
    expect(savedMessage.recipient).toBe(event.data.recipient)
    expect(savedMessage.events).toHaveLength(1)
    expect(savedMessage.events[0]._id).toBe(`${event.source}:${event.id}`)
  })

  test.for(Object.keys(messageEvents))('should save status for new event aggregation document for %s if first event for correlationId', async (eventName) => {
    const event = messageEvents[eventName]
    const expectedStatus = messageEvents[eventName].type.replace(`${MESSAGE_EVENT_PREFIX}`, '')

    await save(event)

    const savedMessage = await db.collection(collections.messages).findOne({ _id: event.data.correlationId })

    expect(savedMessage).toBeDefined()
    expect(savedMessage.status).toBe(expectedStatus)
  })

  test.for(Object.keys(messageEvents))('should update existing event aggregation document for %s if subsequent event for correlationId', async (eventName) => {
    const event = messageEvents[eventName]
    // Save first event
    await save(event)

    // Create a second event with the same correlationId
    const secondEvent = {
      ...event,
      id: `${event.id}-second`,
      type: `${event.type}-2`,
      time: new Date(new Date(event.time).getTime() + 1000).toISOString(),
      data: {
        ...event.data,
        subject: 'Updated Subject'
      }
    }

    await save(secondEvent)

    const expectedStatus = secondEvent.type.replace(`${MESSAGE_EVENT_PREFIX}`, '')

    const updatedMessage = await db.collection(collections.messages).findOne({ _id: event.data.correlationId })

    expect(updatedMessage).toBeDefined()
    expect(updatedMessage.recipient).toBe(event.data.recipient)
    expect(updatedMessage.events).toHaveLength(2)
    expect(updatedMessage.events[1]._id).toBe(`${secondEvent.source}:${secondEvent.id}`)
    expect(updatedMessage.status).toBe(expectedStatus)
  })

  test.for(Object.keys(messageEvents))('should not update existing message status for %s if subsequent event for correlationId if later event exists', async (eventName) => {
    const event = messageEvents[eventName]
    // Save first event
    await save(event)

    // Create a second event with the same correlationId
    const secondEvent = {
      ...event,
      id: `${event.id}-second`,
      time: new Date(new Date(event.time).getTime() - 1000).toISOString(),
      data: {
        ...event.data,
        subject: 'Updated Subject'
      }
    }

    await save(secondEvent)

    const expectedStatus = event.type.replace(`${MESSAGE_EVENT_PREFIX}`, '')

    const updatedMessage = await db.collection(collections.messages).findOne({ _id: event.data.correlationId })

    expect(updatedMessage).toBeDefined()
    expect(updatedMessage.recipient).toBe(event.data.recipient)
    expect(updatedMessage.events).toHaveLength(2)
    expect(updatedMessage.events[1]._id).toBe(`${secondEvent.source}:${secondEvent.id}`)
    expect(updatedMessage.status).toBe(expectedStatus)
  })

  test.for(Object.keys(messageEvents))('should not update event or message collections if duplicate %s event', async (eventName) => {
    const event = messageEvents[eventName]
    // Save first event
    await save(event)

    // Attempt to save duplicate event
    await save(event)

    const eventsCount = await db.collection(collections.events).countDocuments({ _id: `${event.source}:${event.id}` })
    expect(eventsCount).toBe(1)

    const messagesCount = await db.collection(collections.messages).countDocuments({ _id: event.data.correlationId })
    expect(messagesCount).toBe(1)
  })

  test('should append subject and body if provided in subsequent events', async () => {
    const event = messageEvents.messageRequest
    await save(event)

    const updateEvent = {
      ...messageEvents.statusDelivered,
      data: {
        ...messageEvents.statusDelivered.data,
        subject: 'Message Subject',
        body: 'Message Body'
      }
    }

    await save(updateEvent)

    const savedMessage = await db.collection(collections.messages).findOne({ _id: event.data.correlationId })

    expect(savedMessage).toBeDefined()
    expect(savedMessage.subject).toBe(updateEvent.data.subject)
    expect(savedMessage.body).toBe(updateEvent.data.body)
  })
})
