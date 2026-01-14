import { describe, beforeEach, beforeAll, afterAll, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb } from '../../../src/common/helpers/mongodb.js'
import { config } from '../../../src/config/config.js'
import { clearAllCollections } from '../../helpers/mongo.js'
import { getScenario } from '../scenarios.js'
import { processScenarioEvents } from '../../helpers/scenarios.js'

let collections

describe('crm event scenarios', () => {
  beforeAll(async () => {
    await createMongoDbConnection(config.get('mongo'))

    const mongoDb = getMongoDb()
    collections = mongoDb.collections
  })

  beforeEach(async () => {
    await clearAllCollections(collections)

    const events = await collections.events.find({}).toArray()
    expect(events).toHaveLength(0)

    const crm = await collections.crm.find({}).toArray()
    expect(crm).toHaveLength(0)
  })

  afterAll(async () => {
    await closeMongoDbConnection()
  })

  test('should process a crm case created scenario', async () => {
    await processScenarioEvents(getScenario('single.crmCaseCreated'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(1)

    const savedCrm = await collections.crm.find({}).toArray()
    expect(savedCrm).toHaveLength(1)
    expect(savedCrm[0].events.length).toBe(1)
    expect(savedCrm[0].caseId).toBe('case-123')
  })

  test('should process a crm case lifecycle scenario', async () => {
    await processScenarioEvents(getScenario('streams.crmCaseCreatedAndUpdated'))

    const savedEvents = await collections.events.find({}).toArray()
    expect(savedEvents.length).toBe(2)

    const savedCrm = await collections.crm.find({}).toArray()
    expect(savedCrm).toHaveLength(1)
    expect(savedCrm[0].events.length).toBe(2)
  })
})
