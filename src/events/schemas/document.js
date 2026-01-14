import Joi from 'joi'
import cloudEvent from './cloud-event.js'

const document = cloudEvent.keys({
  data: Joi.object({
    correlationId: Joi.string().required(),
    crn: Joi.number().required(),
    sbi: Joi.number().required(),
    file: Joi.object({
      fileId: Joi.string().required(),
      fileName: Joi.string().required(),
      contentType: Joi.string().required(),
      url: Joi.string().required(),
    }).required()
  }).required()
})

export default document
