import Joi from 'joi'
import cloudEvent from './cloud-event.js'

export default cloudEvent.keys({
  data: Joi.object({
    correlationId: Joi.string().required(),
    recipient: Joi.string().required(),
  }).required()
})
