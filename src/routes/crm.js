import { constants as httpConstants } from 'node:http2'
import Joi from 'joi'
import { getCrmCases, getCrmByCaseId } from '../projections/crm.js'
import { getPageLinks } from '../common/helpers/pagination.js'

const { HTTP_STATUS_NOT_FOUND } = httpConstants

const api = [{
  method: 'GET',
  path: '/api/v1/crm',
  options: {
    description: 'Get all CRM cases',
    notes: 'CRM cases can be filtered by SBI or CRN',
    tags: ['api', 'crm'],
    validate: {
      query: {
        crn: Joi.number().optional().description('Filter CRM cases by CRN'),
        sbi: Joi.number().optional().description('Filter CRM cases by SBI'),
        includeEvents: Joi.boolean().default(false).description('Whether to include the event history'),
        page: Joi.number().integer().min(1).default(1).description('The page number for pagination'),
        pageSize: Joi.number().integer().min(1).max(100).default(20).description('The number of items per page for pagination')
      }
    }
  },
  handler: async (request, h) => {
    const { page, pageSize } = request.query

    const { crmCases } = await getCrmCases(request.query)

    return h.response({
      data: { crmCases },
      links: getPageLinks(request, page, pageSize),
      meta: {
        page,
        pageSize
      }
    })
  }
}, {
  method: 'GET',
  path: '/api/v1/crm/{caseId}',
  options: {
    description: 'Get CRM case by caseId',
    notes: 'Returns a CRM case for a given caseId, optionally including event history',
    tags: ['api', 'crm'],
    validate: {
      params: {
        caseId: Joi.string().guid().required().description('The case ID of the CRM record')
      },
      query: {
        includeEvents: Joi.boolean().default(false).description('Whether to include the event history')
      }
    }
  },
  handler: async (request, h) => {
    const { caseId } = request.params
    const { includeEvents } = request.query

    const crmCase = await getCrmByCaseId(caseId, { includeEvents })

    if (!crmCase) {
      return h.response({ error: `CRM case not found with caseId: ${caseId}` }).code(HTTP_STATUS_NOT_FOUND)
    }

    return h.response({ data: { crmCase } })
  }
}]

export { api as crm }
