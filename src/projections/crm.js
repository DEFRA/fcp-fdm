import { BaseRepository } from './base-repository.js'

const crmRepository = new BaseRepository('crm', {
  baseProjectionFields: {
    _id: 1,
    caseId: 1,
    crn: 1,
    sbi: 1,
    status: 1,
    created: 1,
    lastUpdated: 1
  }
})

export async function getCrmByCaseId (caseId, options = {}) {
  return crmRepository.findOne({ caseId }, options)
}

export async function getCrmCases (filters = {}) {
  const crmCases = await crmRepository.findMany(filters, { includeEvents: filters.includeEvents })
  return { crmCases }
}
