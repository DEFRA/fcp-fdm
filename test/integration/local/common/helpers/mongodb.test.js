import { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect } from 'vitest'
import { createMongoDbConnection, closeMongoDbConnection, getMongoDb, configureGlobalTtlIndexes } from '../../../../../src/common/helpers/mongodb.js'
import { config } from '../../../../../src/config/config.js'

const TTL_INDEXES = [
  { collection: 'events', indexName: 'events_ttl' },
  { collection: 'messages', indexName: 'messages_ttl' },
  { collection: 'documents', indexName: 'documents_ttl' },
  { collection: 'crm', indexName: 'crm_ttl' },
  { collection: 'payments', indexName: 'payments_ttl' }
]

let db

beforeAll(async () => {
  await createMongoDbConnection(config.get('mongo'))
  db = getMongoDb().db
})

afterAll(async () => {
  await closeMongoDbConnection()
})

afterEach(async () => {
  const existingCollections = await db.listCollections().toArray()
  const existingNames = new Set(existingCollections.map(c => c.name))

  for (const { collection, indexName } of TTL_INDEXES) {
    if (existingNames.has(collection)) {
      const indexes = await db.collection(collection).indexes()
      if (indexes.some(index => index.name === indexName)) {
        await db.collection(collection).dropIndex(indexName)
      }
    }
  }
})

describe('configureGlobalTtlIndexes', () => {
  describe('when globalTtl is set', () => {
    const globalTtl = 86400

    beforeEach(() => {
      config.set('data.globalTtl', globalTtl)
    })

    test('should create TTL indexes on all collections when none exist', async () => {
      await configureGlobalTtlIndexes(db)

      for (const { collection, indexName } of TTL_INDEXES) {
        const indexes = await db.collection(collection).indexes()
        const ttlIndex = indexes.find(index => index.name === indexName)

        expect(ttlIndex, `expected ${indexName} to exist on ${collection}`).toBeDefined()
        expect(ttlIndex.expireAfterSeconds).toBe(globalTtl)
      }
    })

    test('should not error when called again with the same TTL value', async () => {
      await configureGlobalTtlIndexes(db)
      await expect(configureGlobalTtlIndexes(db)).resolves.toBeUndefined()

      for (const { collection, indexName } of TTL_INDEXES) {
        const indexes = await db.collection(collection).indexes()
        const ttlIndexes = indexes.filter(index => index.name === indexName)

        expect(ttlIndexes, `expected exactly one ${indexName} on ${collection}`).toHaveLength(1)
        expect(ttlIndexes[0].expireAfterSeconds).toBe(globalTtl)
      }
    })

    test('should update TTL indexes on all collections when the TTL value has changed', async () => {
      await configureGlobalTtlIndexes(db)

      const updatedTtl = globalTtl * 2
      config.set('data.globalTtl', updatedTtl)
      await configureGlobalTtlIndexes(db)

      for (const { collection, indexName } of TTL_INDEXES) {
        const indexes = await db.collection(collection).indexes()
        const ttlIndex = indexes.find(index => index.name === indexName)

        expect(ttlIndex, `expected ${indexName} to exist on ${collection}`).toBeDefined()
        expect(ttlIndex.expireAfterSeconds).toBe(updatedTtl)
      }
    })
  })

  describe('when globalTtl is not set', () => {
    beforeEach(() => {
      config.set('data.globalTtl', null)
    })

    test('should remove TTL indexes from all collections when they exist', async () => {
      for (const { collection, indexName } of TTL_INDEXES) {
        const field = collection === 'events' ? 'received' : 'lastUpdated'
        await db.collection(collection).createIndex({ [field]: 1 }, { name: indexName, expireAfterSeconds: 86400 })
      }

      await configureGlobalTtlIndexes(db)

      for (const { collection, indexName } of TTL_INDEXES) {
        const indexes = await db.collection(collection).indexes()
        const ttlIndex = indexes.find(index => index.name === indexName)

        expect(ttlIndex, `expected ${indexName} to be removed from ${collection}`).toBeUndefined()
      }
    })

    test('should not error when no TTL indexes exist', async () => {
      await expect(configureGlobalTtlIndexes(db)).resolves.toBeUndefined()

      for (const { collection, indexName } of TTL_INDEXES) {
        const existingCollections = await db.listCollections({ name: collection }).toArray()
        if (existingCollections.length > 0) {
          const indexes = await db.collection(collection).indexes()
          const ttlIndex = indexes.find(index => index.name === indexName)
          expect(ttlIndex, `expected no ${indexName} on ${collection}`).toBeUndefined()
        }
      }
    })
  })
})
