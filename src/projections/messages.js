import { getMongoDb } from '../common/helpers/mongodb.js'
import { config } from '../config/config.js'

const maxTimeMS = config.get('mongo.maxTimeMS')

export async function getMessageByCorrelationId (correlationId, options = {}) {
  const { collections } = getMongoDb()
  const { messages: messageCollection } = collections

  const { includeContent = false, includeEvents = false } = options

  const projection = buildProjection(includeContent, includeEvents)
  const message = await messageCollection.findOne(
    { _id: correlationId },
    { projection, readPreference: 'secondaryPreferred', maxTimeMS }
  )

  if (!message) {
    return null
  }

  return transformMessage(message, includeEvents)
}

export async function getMessages (filters = {}) {
  const { collections } = getMongoDb()
  const { messages: messageCollection } = collections

  const { crn, sbi, includeContent = false, includeEvents = false, page = 1, pageSize = 20 } = filters

  const query = {}

  if (crn !== undefined) {
    query.crn = crn
  }
  if (sbi !== undefined) {
    query.sbi = sbi
  }

  const projection = buildProjection(includeContent, includeEvents)

  const cursor = messageCollection.find(query, {
    projection,
    sort: { created: -1, _id: -1 },
    readPreference: 'secondaryPreferred',
    maxTimeMS
  })
    .skip((page - 1) * pageSize)
    .limit(pageSize)

  const messages = await cursor.toArray()

  return {
    messages: messages.map(message => transformMessage(message, includeEvents))
  }
}

function buildProjection (includeContent = false, includeEvents = false) {
  const projection = {
    _id: 1,
    crn: 1,
    sbi: 1,
    status: 1,
    created: 1,
    lastUpdated: 1
  }

  if (includeContent) {
    projection.recipient = 1
    projection.subject = 1
    projection.body = 1
  }

  if (includeEvents) {
    projection.events = 1
  }

  return projection
}

function transformMessage (message, includeEvents = false) {
  const { _id, ...rest } = message
  const transformedMessage = {
    correlationId: _id,
    ...rest
  }

  if (includeEvents && transformedMessage.events) {
    transformedMessage.events = transformedMessage.events.map(({ _id: _mongoId, ...event }) => event)
  }

  return transformedMessage
}
