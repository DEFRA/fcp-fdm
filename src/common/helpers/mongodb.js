import { MongoClient } from 'mongodb'
import { LockManager } from 'mongo-locks'

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
      const locker = new LockManager(db.collection('mongo-locks'))

      await createIndexes(db)

      server.logger.info(`MongoDb connected to ${databaseName}`)

      server.decorate('server', 'mongoClient', client)
      server.decorate('server', 'db', db)
      server.decorate('server', 'locker', locker)
      server.decorate('request', 'db', () => db, { apply: true })
      server.decorate('request', 'locker', () => locker, { apply: true })

      let isClosing = false

      server.events.on('stop', () => {
        if (isClosing) {
          return
        }

        isClosing = true

        server.logger.info('Closing Mongo client')

        const closeClient = async () => {
          try {
            if (client.topology && !client.topology.isDestroyed()) {
              await client.close(false)
            }
          } catch (e) {
            if (!e.message?.includes('client was closed')) {
              server.logger.error(e, 'failed to close mongo client')
            }
          }
        }

        closeClient().catch(() => {})
      })
    }
  }
}

async function createIndexes (db) {
  await db.collection('mongo-locks').createIndex({ id: 1 })

  // Add additional collections and indexes here
}
