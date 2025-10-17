import { MongoClient } from 'mongodb'
import { LockManager } from 'mongo-locks'

let mongoDbClient

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
      mongoDbClient = db
      const locker = new LockManager(db.collection('mongo-locks'))

      await createIndexes(db)

      server.logger.info(`MongoDb connected to ${databaseName}`)

      server.decorate('server', 'mongoClient', client)
      server.decorate('server', 'db', db)
      server.decorate('server', 'locker', locker)
      server.decorate('request', 'db', () => db, { apply: true })
      server.decorate('request', 'locker', () => locker, { apply: true })

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

export function getMongoDbClient () {
  return mongoDbClient
}

async function createIndexes (db) {
  try {
    await db.collection('events-temp').drop()
  } catch {}
  await db.collection('mongo-locks').createIndex({ id: 1 })
  await db.collection('events-message').createIndex({ id: 1 }, { unique: true })
}
