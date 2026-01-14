import { constants as httpConstants } from 'node:http2'
import Joi from 'joi'
import { getDocuments, getDocumentByFileId } from '../projections/documents.js'
import { getPageLinks } from '../common/helpers/pagination.js'

const { HTTP_STATUS_NOT_FOUND } = httpConstants

const api = [{
  method: 'GET',
  path: '/api/v1/documents',
  options: {
    description: 'Get all documents',
    notes: 'Documents can be filtered by SBI or CRN',
    tags: ['api', 'documents'],
    validate: {
      query: {
        crn: Joi.number().optional().description('Filter documents by CRN'),
        sbi: Joi.number().optional().description('Filter documents by SBI'),
        includeEvents: Joi.boolean().default(false).description('Whether to include the event history'),
        page: Joi.number().integer().min(1).default(1).description('The page number for pagination'),
        pageSize: Joi.number().integer().min(1).max(100).default(20).description('The number of items per page for pagination')
      }
    }
  },
  handler: async (request, h) => {
    const { page, pageSize } = request.query

    const { documents } = await getDocuments(request.query)

    return h.response({
      data: { documents },
      links: getPageLinks(request, page, pageSize),
      meta: {
        page,
        pageSize
      }
    })
  }
}, {
  method: 'GET',
  path: '/api/v1/documents/{fileId}',
  options: {
    description: 'Get document by fileId',
    notes: 'Returns a document for a given fileId, optionally including event history',
    tags: ['api', 'documents'],
    validate: {
      params: {
        fileId: Joi.string().guid().required().description('The file ID of the document')
      },
      query: {
        includeEvents: Joi.boolean().default(false).description('Whether to include the event history')
      }
    }
  },
  handler: async (request, h) => {
    const { fileId } = request.params
    const { includeEvents } = request.query

    const document = await getDocumentByFileId(fileId, { includeEvents })

    if (!document) {
      return h.response({ error: `Document not found with fileId: ${fileId}` }).code(HTTP_STATUS_NOT_FOUND)
    }

    return h.response({ data: { document } })
  }
}]

export { api as documents }
