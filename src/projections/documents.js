import { getMongoDb } from '../common/helpers/mongodb.js'
import { config } from '../config/config.js'

const maxTimeMS = config.get('mongo.maxTimeMS')

export async function getDocumentByFileId (fileId, options = {}) {
  const { collections } = getMongoDb()
  const { documents: documentCollection } = collections

  const { includeEvents = false } = options

  const projection = buildProjection(includeEvents)
  const document = await documentCollection.findOne(
    { fileId },
    { projection, readPreference: 'secondaryPreferred', maxTimeMS }
  )

  if (!document) {
    return null
  }

  return transformDocument(document, includeEvents)
}

export async function getDocuments (filters = {}) {
  const { collections } = getMongoDb()
  const { documents: documentCollection } = collections

  const { crn, sbi, includeEvents = false, page = 1, pageSize = 20 } = filters

  const query = {}

  if (crn !== undefined) {
    query.crn = crn
  }
  if (sbi !== undefined) {
    query.sbi = sbi
  }

  const projection = buildProjection(includeEvents)

  const cursor = documentCollection.find(query, {
    projection,
    sort: { created: -1, _id: -1 },
    readPreference: 'secondaryPreferred',
    maxTimeMS
  })
    .skip((page - 1) * pageSize)
    .limit(pageSize)

  const documents = await cursor.toArray()

  return {
    documents: documents.map(document => transformDocument(document, includeEvents))
  }
}

function buildProjection (includeEvents = false) {
  const projection = {
    _id: 1,
    fileId: 1,
    crn: 1,
    sbi: 1,
    status: 1,
    created: 1,
    lastUpdated: 1
  }

  if (includeEvents) {
    projection.events = 1
  }

  return projection
}

function transformDocument (document, includeEvents = false) {
  const { _id, ...rest } = document
  const transformedDocument = {
    ...rest
  }

  if (includeEvents && transformedDocument.events) {
    transformedDocument.events = transformedDocument.events.map(({ _id: _mongoId, ...event }) => event)
  }

  return transformedDocument
}
