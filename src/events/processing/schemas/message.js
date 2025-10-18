import Joi from 'joi'

const schema = Joi.object({
  correlationId: Joi.string().required(),
  recipient: Joi.string().required(),
})

export default schema
