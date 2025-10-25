import { constants as httpConstants } from 'node:http2'
import Joi from 'joi'
import { getMessages, getMessageByCorrelationId } from '../projections/messages.js'

const { HTTP_STATUS_NOT_FOUND } = httpConstants

const api = [{
  method: 'GET',
  path: '/api/v1/messages',
  options: {
    description: 'Get all messages',
    notes: 'Messages can be filtered by SBI or CRN',
    tags: ['api', 'messages'],
    validate: {
      query: {
        crn: Joi.number().optional().description('Filter messages by CRN'),
        sbi: Joi.number().optional().description('Filter messages by SBI'),
        includeContent: Joi.boolean().default(false).description('Whether to include the recipient, subject and body'),
        includeEvents: Joi.boolean().default(false).description('Whether to include the event history'),
        page: Joi.number().integer().min(1).default(1).description('The page number for pagination'),
        pageSize: Joi.number().integer().min(1).max(100).default(20).description('The number of items per page for pagination')
      }
    }
  },
  handler: async (request, h) => {
    const { crn, sbi, includeContent, includeEvents, page, pageSize } = request.query

    const messages = await getMessages({ crn, sbi, includeContent, includeEvents })

    return h.response({ data: { messages } })
  }
}, {
  method: 'GET',
  path: '/api/v1/messages/{correlationId}',
  options: {
    description: 'Get message by correlationId',
    notes: 'Returns a message for a given correlationId, optionally including content and event history',
    tags: ['api', 'messages'],
    validate: {
      params: {
        correlationId: Joi.string().guid().required().description('The correlation ID of the message')
      },
      query: {
        includeContent: Joi.boolean().default(false).description('Whether to include the recipient, subject and body'),
        includeEvents: Joi.boolean().default(false).description('Whether to include the event history')
      }
    }
  },
  handler: async (request, h) => {
    const { correlationId } = request.params
    const { includeContent, includeEvents } = request.query

    const message = await getMessageByCorrelationId(correlationId, { includeContent, includeEvents })

    if (!message) {
      return h.response({ error: `Message not found with correlationId: ${correlationId}` }).code(HTTP_STATUS_NOT_FOUND)
    }

    return h.response({ data: { message } })
  }
}]

export { api as messages }
