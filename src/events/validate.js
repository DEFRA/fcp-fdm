import cloudEventsSchema from './schemas/cloud-event.js'
import messageSchema from './schemas/message.js'
import documentSchema from './schemas/document.js'
import crmSchema from './schemas/crm.js'
import paymentSchema from './schemas/payment.js'

const validators = {
  message: messageSchema,
  messageRejected: cloudEventsSchema,
  document: documentSchema,
  crm: crmSchema,
  payment: paymentSchema
}

export async function validateEvent (event, eventType) {
  const schema = validators[eventType]

  const validationResult = schema.validate(event, { abortEarly: false, allowUnknown: true, stripUnknown: true })

  if (validationResult.error) {
    throw new Error(`Event is invalid, ${validationResult.error.message}`)
  }
}
