import Joi from 'joi'
import { getPaymentData } from '../data/search.js'
import { getAllPaymentsCsvStream, getPaymentsCsv } from '../data/payments.js'

const payments = [
  {
    method: 'POST',
    path: '/v1/payments',
    options: {
      description: 'Search for payment data with filters',
      notes: 'Returns paginated payment data based on search criteria and filters',
      tags: ['api', 'payments'],
      validate: {
        payload: Joi.object({
          searchString: Joi.string().trim().min(1).required(),
          limit: Joi.number().integer().positive().required(),
          offset: Joi.number().integer().positive().allow(0).default(0),
          sortBy: Joi.string().default('score'),
          filterBy: Joi.object({
            schemes: Joi.array().items(Joi.string().trim().lowercase()),
            counties: Joi.array().items(Joi.string().trim().lowercase()),
            amounts: Joi.array().items(Joi.string()),
            years: Joi.array().items(Joi.string())
          }).default({}),
          action: Joi.string().trim().optional()
        }),
        failAction: async (_request, h, error) =>
          h.response(error.toString()).code(400).takeover()
      },
      handler: async (request, h) => {
        const paymentData = await getPaymentData(request.payload)
        return h.response(paymentData)
      }
    }
  },
  {
    method: 'POST',
    path: '/v1/payments/file',
    options: {
      description: 'Download payment search results as CSV',
      notes: 'Returns CSV file containing payment data based on search criteria and filters',
      tags: ['api', 'payments'],
      validate: {
        payload: Joi.object({
          searchString: Joi.string().trim().min(1).required(),
          sortBy: Joi.string().default('score'),
          filterBy: Joi.object({
            schemes: Joi.array().items(Joi.string().trim().lowercase()),
            counties: Joi.array().items(Joi.string().trim().lowercase()),
            amounts: Joi.array().items(Joi.string()),
            years: Joi.array().items(Joi.string())
          }).default({})
        }),
        failAction: async (_request, h, error) =>
          h.response(error.toString()).code(400).takeover()
      },
      handler: async (request, h) => {
        const paymentData = await getPaymentsCsv(request.payload)
        return h.response(paymentData)
      }
    }
  },
  {
    method: 'GET',
    path: '/v1/payments/file',
    options: {
      description: 'Download all payments as CSV stream',
      notes: 'Returns a CSV stream containing all payment data in the database',
      tags: ['api', 'payments']
    },
    handler: async (_request, h) => {
      const paymentsStream = getAllPaymentsCsvStream()
      return h.response(paymentsStream)
    }
  }
]

export { payments }
