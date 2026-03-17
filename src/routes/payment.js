import { constants as httpConstants } from 'node:http2'
import Joi from 'joi'
import { getPayments, getPaymentByCorrelationId } from '../projections/payment.js'
import { getPageLinks } from '../common/helpers/pagination.js'

const { HTTP_STATUS_NOT_FOUND } = httpConstants

const api = [{
  method: 'GET',
  path: '/payments',
  options: {
    description: 'Get all payments',
    notes: 'Payments can be filtered by FRN, SBI, schemeId, scheme, vendor, or trader',
    tags: ['api', 'payments'],
    validate: {
      query: {
        frn: Joi.number().optional().description('Filter payments by FRN'),
        sbi: Joi.number().optional().description('Filter payments by SBI'),
        schemeId: Joi.number().optional().description('Filter payments by scheme ID'),
        scheme: Joi.string().optional().description('Filter payments by scheme'),
        vendor: Joi.string().optional().description('Filter payments by vendor'),
        trader: Joi.string().optional().description('Filter payments by trader'),
        includeEvents: Joi.boolean().default(false).description('Whether to include the event history'),
        page: Joi.number().integer().min(1).default(1).description('The page number for pagination'),
        pageSize: Joi.number().integer().min(1).max(100).default(20).description('The number of items per page for pagination')
      }
    }
  },
  handler: async (request, h) => {
    const { page, pageSize } = request.query

    const { payments } = await getPayments(request.query)

    return h.response({
      data: { payments },
      links: getPageLinks(request, page, pageSize),
      meta: {
        page,
        pageSize
      }
    })
  }
}, {
  method: 'GET',
  path: '/payments/{correlationId}',
  options: {
    description: 'Get payment by correlationId',
    notes: 'Returns a payment for a given correlationId, optionally including event history',
    tags: ['api', 'payments'],
    validate: {
      params: {
        correlationId: Joi.string().guid().required().description('The correlation ID of the payment')
      },
      query: {
        includeEvents: Joi.boolean().default(false).description('Whether to include the event history')
      }
    }
  },
  handler: async (request, h) => {
    const { correlationId } = request.params
    const { includeEvents } = request.query

    const payment = await getPaymentByCorrelationId(correlationId, { includeEvents })

    if (!payment) {
      return h.response({ error: `Payment not found with correlationId: ${correlationId}` }).code(HTTP_STATUS_NOT_FOUND)
    }

    return h.response({ data: { payment } })
  }
}]

export { api as payments }
