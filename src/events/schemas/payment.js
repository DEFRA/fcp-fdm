import Joi from 'joi'
import cloudEvent from './cloud-event.js'

const payment = cloudEvent.keys({
  data: Joi.object({
    frn: Joi.number().integer().positive().optional().allow('', null),
    sbi: Joi.number().integer().positive().optional().allow('', null),
    trader: Joi.string().optional().allow('', null),
    vendor: Joi.string().optional().allow('', null),
    correlationId: Joi.string().guid().required(),
    schemeId: Joi.number().integer().positive().required(),
    invoiceNumber: Joi.string().required()
  }).required().custom((value, helpers) => {
    const { frn, sbi, trader, vendor } = value

    if (!frn && !sbi && !trader && !vendor) {
      return helpers.error('any.custom', { message: 'No customer identifier has been provided' })
    }

    return value
  })
})

export default payment
