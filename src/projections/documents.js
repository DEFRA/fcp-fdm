import { BaseRepository } from './base-repository.js'
import { getMongoDb } from '../common/helpers/mongodb.js'
import { config } from '../config/config.js'

const maxTimeMS = config.get('mongo.maxTimeMS')

const documentRepository = new BaseRepository('documents', {
  baseProjectionFields: {
    _id: 1,
    fileId: 1,
    crn: 1,
    sbi: 1,
    status: 1,
    created: 1,
    lastUpdated: 1
  }
})

export async function getDocumentByFileId (fileId, options = {}) {
  const { includeEvents = false, includeCrm = false } = options

  const document = await documentRepository.findOne({ fileId }, { includeEvents })

  if (!document) {
    return null
  }

  if (includeCrm) {
    const { collections } = getMongoDb()
    const { crm: crmCollection } = collections

    const crmCases = await crmCollection.find(
      { fileIds: fileId },
      { readPreference: 'secondaryPreferred', maxTimeMS }
    ).toArray()

    document.crmCases = crmCases.map(({ _id, events, ...crmCase }) => crmCase)
  }

  return document
}

export async function getDocuments (filters = {}) {
  const documents = await documentRepository.findMany(filters, { includeEvents: filters.includeEvents })
  return { documents }
}
