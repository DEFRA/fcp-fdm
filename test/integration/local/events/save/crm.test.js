import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../../src/config/config.js'
import { crmCaseCreated, crmCaseUpdated } from '../../../../mocks/events.js'
import { save } from '../../../../../src/events/save/crm.js'
import { clearAllCollections } from '../../../../helpers/mongo.js'
import { eventTypePrefixes } from '../../../../../src/events/types.js'

const { CRM_EVENT_PREFIX } = eventTypePrefixes

const crmEvents = {
  crmCaseCreated,
  crmCaseUpdated
}

let collections

describe('save', () => {
  beforeAll(async () => {
    await createMongoDbConnection(config.get('mongo'))

    const mongoDb = getMongoDb()
    collections = mongoDb.collections
  })

  beforeEach(async () => {
    await clearAllCollections(collections)
  })

  afterAll(async () => {
    await closeMongoDbConnection()
  })

  test.for(Object.keys(crmEvents))('should save event to event collection for %s with composite _id', async (eventName) => {
    const event = crmEvents[eventName]

    await save(event)

    const savedEvent = await collections.events.findOne({ _id: `${event.source}:${event.id}` })

    expect(savedEvent).toBeDefined()
    expect(savedEvent.id).toBe(event.id)
  })

  test.for(Object.keys(crmEvents))('should save new event aggregation document for %s if first event for correlationId:caseId', async (eventName) => {
    const event = crmEvents[eventName]

    await save(event)

    const savedCrm = await collections.crm.findOne({
      _id: `${event.data.correlationId}:${event.data.caseId}`
    })

    expect(savedCrm).toBeDefined()
    expect(savedCrm.caseId).toBe(event.data.caseId)
    expect(savedCrm.caseType).toBe(event.data.caseType)
    expect(savedCrm.correlationId).toBe(event.data.correlationId)
    expect(savedCrm.crn).toBe(event.data.crn)
    expect(savedCrm.sbi).toBe(event.data.sbi)
    expect(savedCrm.events).toHaveLength(1)
    expect(savedCrm.events[0]._id).toBe(`${event.source}:${event.id}`)
  })

  test.for(Object.keys(crmEvents))('should save status for new event aggregation document for %s if first event for correlationId:caseId', async (eventName) => {
    const event = crmEvents[eventName]
    const expectedStatus = crmEvents[eventName].type.replace(`${CRM_EVENT_PREFIX}`, '')

    await save(event)

    const savedCrm = await collections.crm.findOne({
      _id: `${event.data.correlationId}:${event.data.caseId}`
    })

    expect(savedCrm).toBeDefined()
    expect(savedCrm.status).toBe(expectedStatus)
  })

  test.for(Object.keys(crmEvents))('should update existing event aggregation document for %s if subsequent event for correlationId:caseId', async (eventName) => {
    const event = crmEvents[eventName]
    // Save first event
    await save(event)

    // Create a second event with the same correlationId and caseId
    const secondEvent = {
      ...event,
      id: `${event.id}-second`,
      type: `${event.type}-2`,
      time: new Date(new Date(event.time).getTime() + 1000).toISOString()
    }

    await save(secondEvent)

    const expectedStatus = secondEvent.type.replace(`${CRM_EVENT_PREFIX}`, '')

    const updatedCrm = await collections.crm.findOne({
      _id: `${event.data.correlationId}:${event.data.caseId}`
    })

    expect(updatedCrm).toBeDefined()
    expect(updatedCrm.caseId).toBe(event.data.caseId)
    expect(updatedCrm.caseType).toBe(event.data.caseType)
    expect(updatedCrm.events).toHaveLength(2)
    expect(updatedCrm.events[1]._id).toBe(`${secondEvent.source}:${secondEvent.id}`)
    expect(updatedCrm.status).toBe(expectedStatus)
  })

  test.for(Object.keys(crmEvents))('should not update existing crm status for %s if subsequent event for correlationId:caseId if later event exists', async (eventName) => {
    const event = crmEvents[eventName]
    // Save first event
    await save(event)

    // Create a second event with the same correlationId and caseId but earlier time
    const secondEvent = {
      ...event,
      id: `${event.id}-second`,
      time: new Date(new Date(event.time).getTime() - 1000).toISOString()
    }

    await save(secondEvent)

    const expectedStatus = event.type.replace(`${CRM_EVENT_PREFIX}`, '')

    const updatedCrm = await collections.crm.findOne({
      _id: `${event.data.correlationId}:${event.data.caseId}`
    })

    expect(updatedCrm).toBeDefined()
    expect(updatedCrm.caseId).toBe(event.data.caseId)
    expect(updatedCrm.caseType).toBe(event.data.caseType)
    expect(updatedCrm.events).toHaveLength(2)
    expect(updatedCrm.events[1]._id).toBe(`${secondEvent.source}:${secondEvent.id}`)
    expect(updatedCrm.status).toBe(expectedStatus)
  })

  test.for(Object.keys(crmEvents))('should not update event or crm collections if duplicate %s event', async (eventName) => {
    const event = crmEvents[eventName]
    // Save first event
    await save(event)

    // Attempt to save duplicate event
    await save(event)

    const eventsCount = await collections.events.countDocuments({ _id: `${event.source}:${event.id}` })
    expect(eventsCount).toBe(1)

    const crmCount = await collections.crm.countDocuments({
      _id: `${event.data.correlationId}:${event.data.caseId}`
    })
    expect(crmCount).toBe(1)
  })

  test('should update caseType if provided in subsequent events', async () => {
    const event = crmCaseCreated
    await save(event)

    const updateEvent = {
      ...crmCaseUpdated,
      id: `${crmCaseUpdated.id}-update`,
      time: new Date(new Date(crmCaseUpdated.time).getTime() + 1000).toISOString(),
      data: {
        ...crmCaseUpdated.data,
        caseType: 'COMPLAINT'
      }
    }

    await save(updateEvent)

    const savedCrm = await collections.crm.findOne({
      _id: `${event.data.correlationId}:${event.data.caseId}`
    })

    expect(savedCrm).toBeDefined()
    expect(savedCrm.caseType).toBe(updateEvent.data.caseType)
  })

  test('should store all data fields in crm collection', async () => {
    const event = crmCaseCreated
    await save(event)

    const savedCrm = await collections.crm.findOne({
      _id: `${event.data.correlationId}:${event.data.caseId}`
    })

    expect(savedCrm).toBeDefined()
    expect(savedCrm.correlationId).toBe(event.data.correlationId)
    expect(savedCrm.crn).toBe(event.data.crn)
    expect(savedCrm.sbi).toBe(event.data.sbi)
    expect(savedCrm.caseId).toBe(event.data.caseId)
    expect(savedCrm.caseType).toBe(event.data.caseType)
  })
})
