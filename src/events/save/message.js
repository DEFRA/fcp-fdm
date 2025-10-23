import { getMongoDb } from '../../common/helpers/mongodb.js'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { eventTypePrefixes } from '../types.js'

const { MESSAGE_EVENT_PREFIX } = eventTypePrefixes

const logger = createLogger()

export async function save (event) {
  const { correlationId, recipient, crn, sbi } = event.data
  const { subject, body } = event.data.content || {}
  const status = extractStatus(event.type)

  const { db, client, collections } = getMongoDb()
  const { events: eventCollection, messages: messageCollection } = collections
  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      const now = new Date()

      const eventEntity = { _id: `${event.source}:${event.id}`, ...event, received: now }

      // save new event
      await db.collection(eventCollection).insertOne(eventEntity, { session })

      // save new/update existing message
      await db.collection(messageCollection).updateOne(
        { _id: correlationId },
        {
          $setOnInsert: { _id: correlationId, recipient, created: now },
          $set: {
            lastUpdated: now,
            ...(subject && { subject }),
            ...(body && { body }),
            ...(crn && { crn }),
            ...(sbi && { sbi })
          },
          $push: { events: eventEntity }
        },
        { session, upsert: true }
      )

      // update message status
      if (status) {
        await db.collection(messageCollection).updateOne(
          { _id: correlationId },
          [
            {
              $set: {
                status: {
                  $let: {
                    vars: {
                      latestEvent: {
                        $arrayElemAt: [
                          {
                            $sortArray: {
                              input: '$events',
                              sortBy: { time: -1 }
                            }
                          },
                          0
                        ]
                      }
                    },
                    in: {
                      $substr: [
                        '$$latestEvent.type',
                        { $strLenCP: MESSAGE_EVENT_PREFIX },
                        -1
                      ]
                    }
                  }
                }
              }
            }
          ],
          { session }
        )
      }
    })

    logger.info(`Saved message event. ID: ${event.id}, Correlation ID: ${correlationId}, Status: ${status}`)
  } catch (err) {
    if (err.message.includes('E11000 duplicate key error')) {
      logger.warn(`Skipping duplicate event. ID: ${event.id}`)
    } else {
      throw err
    }
  } finally {
    await session.endSession()
  }
}

function extractStatus (eventType) {
  if (!eventType.startsWith(MESSAGE_EVENT_PREFIX)) {
    return null
  }
  return eventType.substring(MESSAGE_EVENT_PREFIX.length)
}
