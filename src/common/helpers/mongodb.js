import { MongoClient } from 'mongodb'
import { config } from '../../config.js'

let mongoDbClient
let mongoDbDatabase

export const mongoDb = {
  plugin: {
    name: 'mongodb',
    version: '1.0.0',
    register: async function (server, options) {
      server.logger.info('Setting up MongoDb')

      const client = await MongoClient.connect(options.mongoUrl, {
        ...options.mongoOptions
      })

      const databaseName = options.databaseName
      const db = client.db(databaseName)

      mongoDbClient = client
      mongoDbDatabase = db

      await createIndexes(db)

      server.logger.info(`MongoDb connected to ${databaseName}`)

      server.decorate('server', 'mongoClient', client)
      server.decorate('server', 'db', db)
      server.decorate('request', 'db', () => db, { apply: true })

      server.events.on('stop', async () => {
        server.logger.info('Closing Mongo client')
        try {
          await client.close(true)
        } catch (err) {
          server.logger.error(err, 'failed to close mongo client')
        }
      })
    }
  }
}

export function getMongoDb () {
  return { client: mongoDbClient, db: mongoDbDatabase }
}

async function createIndexes (db) {
  const defunctCollections = ['mongo-locks', 'events-temp']
  const collections = await db.listCollections().toArray()

  for (const defunctCollection of defunctCollections) {
    if (collections.some(c => c.name === defunctCollection)) {
      await db.collection(defunctCollection).drop()
    }
  }

  await db.collection('events').createIndex({ type: 1, received: -1 }, { name: 'events_type_by_received' })
  await db.collection('events').createIndex({ type: 1, time: -1 }, { name: 'events_type_by_time' })

  const globalTtl = config.get('data.globalTtl')

  if (globalTtl) {
    await db.collection('events').createIndex({ received: 1 }, { name: 'events_ttl', expireAfterSeconds: globalTtl })
    await db.collection('messages').createIndex({ lastUpdated: 1 }, { name: 'messages_ttl', expireAfterSeconds: globalTtl })
  } else {
    const indexes = await db.collection('events').indexes()
    if (indexes.some(index => index.name === 'events_ttl')) {
      await db.collection('events').dropIndex('events_ttl')
    }
    const messageIndexes = await db.collection('messages').indexes()
    if (messageIndexes.some(index => index.name === 'messages_ttl')) {
      await db.collection('messages').dropIndex('messages_ttl')
    }
  }
}
