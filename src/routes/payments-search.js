import Joi from 'joi'
import { getSearchSuggestions } from '../data/search.js'

const paymentsSearch = {
  method: 'GET',
  path: '/v1/payments/search',
  options: {
    description: 'Get search suggestions for payee names',
    notes: 'Returns autocomplete suggestions based on a search string',
    tags: ['api', 'payments'],
    validate: {
      query: Joi.object({
        searchString: Joi.string().trim().min(1).required()
      }),
      failAction: async (_request, h, error) =>
        h.response(error.toString()).code(400).takeover()
    },
    handler: async (request, h) => {
      const suggestions = await getSearchSuggestions(request.query.searchString)
      return h.response(suggestions).code(!suggestions.rows.length ? 404 : 200)
    }
  }
}

export { paymentsSearch }
