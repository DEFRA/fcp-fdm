import Joi from 'joi'
import cloudEvent from './cloud-event.js'

const message = cloudEvent.keys({
  data: Joi.object({
    correlationId: Joi.string().required(),
    crn: Joi.number().required(),
    sbi: Joi.number().required(),
    caseId: Joi.string().required(),
    caseType: Joi.string().required(),
  }).required()
})

export default message
