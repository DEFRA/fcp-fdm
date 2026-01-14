import { getMongoDb } from '../common/helpers/mongodb.js'
import { config } from '../config/config.js'

const maxTimeMS = config.get('mongo.maxTimeMS')

export async function getCrmByCaseId (caseId, options = {}) {
  const { collections } = getMongoDb()
  const { crm: crmCollection } = collections

  const { includeEvents = false } = options

  const projection = buildProjection(includeEvents)
  const crmCase = await crmCollection.findOne(
    { caseId },
    { projection, readPreference: 'secondaryPreferred', maxTimeMS }
  )

  if (!crmCase) {
    return null
  }

  return transformCrm(crmCase, includeEvents)
}

export async function getCrmCases (filters = {}) {
  const { collections } = getMongoDb()
  const { crm: crmCollection } = collections

  const { crn, sbi, includeEvents = false, page = 1, pageSize = 20 } = filters

  const query = {}

  if (crn !== undefined) {
    query.crn = crn
  }
  if (sbi !== undefined) {
    query.sbi = sbi
  }

  const projection = buildProjection(includeEvents)

  const cursor = crmCollection.find(query, {
    projection,
    sort: { created: -1, _id: -1 },
    readPreference: 'secondaryPreferred',
    maxTimeMS
  })
    .skip((page - 1) * pageSize)
    .limit(pageSize)

  const crmCases = await cursor.toArray()

  return {
    crmCases: crmCases.map(crm => transformCrm(crm, includeEvents))
  }
}

function buildProjection (includeEvents = false) {
  const projection = {
    _id: 1,
    caseId: 1,
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

function transformCrm (crm, includeEvents = false) {
  const { _id, ...rest } = crm
  const transformedCrm = {
    ...rest
  }

  if (includeEvents && transformedCrm.events) {
    transformedCrm.events = transformedCrm.events.map(({ _id: _mongoId, ...event }) => event)
  }

  return transformedCrm
}
