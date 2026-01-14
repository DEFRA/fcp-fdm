import { MongoClient } from 'mongodb'
import { config } from '../../config/config.js'

const EVENT_COLLECTION_NAME = 'events'
const MESSAGE_COLLECTION_NAME = 'messages'
const DOCUMENT_COLLECTION_NAME = 'documents'
const CRM_COLLECTION_NAME = 'crm'

const mongo = {
  collections: {}
}

export const mongoDb = {
  plugin: {
    name: 'mongodb',
    version: '1.0.0',
    register: async function (server, options) {
      server.logger.info('Setting up MongoDb')

      await createMongoDbConnection(options)

      server.logger.info(`MongoDb connected to ${options.databaseName}`)
      server.events.on('stop', async () => {
        server.logger.info('Closing Mongo client')
        try {
          await closeMongoDbConnection()
        } catch (err) {
          server.logger.error(err, 'failed to close mongo client')
        }
      })
    }
  },
  options: config.get('mongo')
}

export async function createMongoDbConnection (options) {
  if (!mongo.client || !mongo.db) {
    mongo.client = await MongoClient.connect(options.mongoUrl, {
      ...options.mongoOptions
    })
    mongo.db = mongo.client.db(options.databaseName)
    mongo.databaseName = options.databaseName
    mongo.collections = {
      events: mongo.db.collection(EVENT_COLLECTION_NAME),
      messages: mongo.db.collection(MESSAGE_COLLECTION_NAME),
      documents: mongo.db.collection(DOCUMENT_COLLECTION_NAME),
      crm: mongo.db.collection(CRM_COLLECTION_NAME)
    }

    await createIndexes(mongo.db)
    await configureGlobalTtlIndexes(mongo.db)
  }
}

export async function closeMongoDbConnection () {
  await mongo.client?.close(true)
}

export function getMongoDb () {
  return { client: mongo.client, db: mongo.db, collections: mongo.collections }
}

async function createIndexes (db) {
  await db.collection(EVENT_COLLECTION_NAME).createIndex({ type: 1, received: -1 }, { name: 'events_type_by_received' })
  await db.collection(EVENT_COLLECTION_NAME).createIndex({ type: 1, time: -1 }, { name: 'events_type_by_time' })
  await db.collection(MESSAGE_COLLECTION_NAME).createIndex({ created: -1, _id: -1 }, { name: 'messages_by_created' })
  await db.collection(MESSAGE_COLLECTION_NAME).createIndex({ crn: 1, created: -1, _id: -1 }, { name: 'messages_by_crn_created' })
  await db.collection(MESSAGE_COLLECTION_NAME).createIndex({ sbi: 1, created: -1, _id: -1 }, { name: 'messages_by_sbi_created' })
  await db.collection(MESSAGE_COLLECTION_NAME).createIndex({ crn: 1, sbi: 1, created: -1, _id: -1 }, { name: 'messages_by_crn_sbi_created' })
  await db.collection(DOCUMENT_COLLECTION_NAME).createIndex({ created: -1, _id: -1 }, { name: 'documents_by_created' })
  await db.collection(DOCUMENT_COLLECTION_NAME).createIndex({ crn: 1, created: -1, _id: -1 }, { name: 'documents_by_crn_created' })
  await db.collection(DOCUMENT_COLLECTION_NAME).createIndex({ sbi: 1, created: -1, _id: -1 }, { name: 'documents_by_sbi_created' })
  await db.collection(DOCUMENT_COLLECTION_NAME).createIndex({ crn: 1, sbi: 1, created: -1, _id: -1 }, { name: 'documents_by_crn_sbi_created' })
  await db.collection(CRM_COLLECTION_NAME).createIndex({ created: -1, _id: -1 }, { name: 'crm_by_created' })
  await db.collection(CRM_COLLECTION_NAME).createIndex({ crn: 1, created: -1, _id: -1 }, { name: 'crm_by_crn_created' })
  await db.collection(CRM_COLLECTION_NAME).createIndex({ sbi: 1, created: -1, _id: -1 }, { name: 'crm_by_sbi_created' })
  await db.collection(CRM_COLLECTION_NAME).createIndex({ crn: 1, sbi: 1, created: -1, _id: -1 }, { name: 'crm_by_crn_sbi_created' })
}

async function configureGlobalTtlIndexes (db) {
  const globalTtl = config.get('data.globalTtl')

  if (globalTtl) {
    await db.collection(EVENT_COLLECTION_NAME).createIndex({ received: 1 }, { name: 'events_ttl', expireAfterSeconds: globalTtl })
    await db.collection(MESSAGE_COLLECTION_NAME).createIndex({ lastUpdated: 1 }, { name: 'messages_ttl', expireAfterSeconds: globalTtl })
    await db.collection(DOCUMENT_COLLECTION_NAME).createIndex({ lastUpdated: 1 }, { name: 'documents_ttl', expireAfterSeconds: globalTtl })
    await db.collection(CRM_COLLECTION_NAME).createIndex({ lastUpdated: 1 }, { name: 'crm_ttl', expireAfterSeconds: globalTtl })
  } else {
    await removeTtlIndexes(db)
  }
}

async function removeTtlIndexes (db) {
  const collections = await db.listCollections().toArray()
  const ttlIndexesToRemove = [
    { collection: EVENT_COLLECTION_NAME, indexName: 'events_ttl' },
    { collection: MESSAGE_COLLECTION_NAME, indexName: 'messages_ttl' },
    { collection: DOCUMENT_COLLECTION_NAME, indexName: 'documents_ttl' },
    { collection: CRM_COLLECTION_NAME, indexName: 'crm_ttl' }
  ]

  for (const { collection, indexName } of ttlIndexesToRemove) {
    if (collections.some(c => c.name === collection)) {
      const indexes = await db.collection(collection).indexes()
      if (indexes.some(index => index.name === indexName)) {
        await db.collection(collection).dropIndex(indexName)
      }
    }
  }
}
