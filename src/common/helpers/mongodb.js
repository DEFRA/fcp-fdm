import { MongoClient } from 'mongodb'
import { config } from '../../config/config.js'

const EVENT_COLLECTION = 'events'
const MESSAGE_COLLECTION = 'messages'

const mongoDbCollections = {
  events: EVENT_COLLECTION,
  messages: MESSAGE_COLLECTION
}

const mongoConsumer = {}
const mongoApi = {}

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
  if (!mongoConsumer.client || !mongoConsumer.db) {
    mongoConsumer.client = await MongoClient.connect(options.mongoUrl, {
      ...options.mongoOptions,
      maxPoolSize: 20
    })
    mongoConsumer.db = mongoConsumer.client.db(options.databaseName)
    mongoConsumer.databaseName = options.databaseName

    await createIndexes(mongoConsumer.db)
    await configureGlobalTtlIndexes(mongoConsumer.db)
  }

  if (!mongoApi.client || !mongoApi.db) {
    mongoApi.client = await MongoClient.connect(options.mongoUrl, {
      ...options.mongoOptions,
      maxPoolSize: 40
    })
    mongoApi.db = mongoApi.client.db(options.databaseName)
    mongoApi.databaseName = options.databaseName
  }
}

export async function closeMongoDbConnection () {
  await mongoConsumer.client?.close(true)
  await mongoApi.client?.close(true)
}

export function getMongoDb (readOnly = false) {
  if (readOnly) {
    return { client: mongoApi.client, db: mongoApi.db, collections: mongoDbCollections }
  }

  return { client: mongoConsumer.client, db: mongoConsumer.db, collections: mongoDbCollections }
}

async function createIndexes (db) {
  await db.collection(EVENT_COLLECTION).createIndex({ type: 1, received: -1 }, { name: 'events_type_by_received' })
  await db.collection(EVENT_COLLECTION).createIndex({ type: 1, time: -1 }, { name: 'events_type_by_time' })
  await db.collection(MESSAGE_COLLECTION).createIndex({ created: -1, _id: -1 }, { name: 'messages_by_created' })
  await db.collection(MESSAGE_COLLECTION).createIndex({ crn: 1, created: -1, _id: -1 }, { name: 'messages_by_crn_created' })
  await db.collection(MESSAGE_COLLECTION).createIndex({ sbi: 1, created: -1, _id: -1 }, { name: 'messages_by_sbi_created' })
  await db.collection(MESSAGE_COLLECTION).createIndex({ crn: 1, sbi: 1, created: -1, _id: -1 }, { name: 'messages_by_crn_sbi_created' })
}

async function configureGlobalTtlIndexes (db) {
  const globalTtl = config.get('data.globalTtl')

  if (globalTtl) {
    await db.collection(EVENT_COLLECTION).createIndex({ received: 1 }, { name: 'events_ttl', expireAfterSeconds: globalTtl })
    await db.collection(MESSAGE_COLLECTION).createIndex({ lastUpdated: 1 }, { name: 'messages_ttl', expireAfterSeconds: globalTtl })
  } else {
    await removeTtlIndexes(db)
  }
}

async function removeTtlIndexes (db) {
  const collections = await db.listCollections().toArray()
  const ttlIndexesToRemove = [
    { collection: EVENT_COLLECTION, indexName: 'events_ttl' },
    { collection: MESSAGE_COLLECTION, indexName: 'messages_ttl' }
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
