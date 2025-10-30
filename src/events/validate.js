import messageSchema from './schemas/message.js'

const validators = {
  message: messageSchema
}

export async function validateEvent (event, eventType) {
  const schema = validators[eventType]

  const validationResult = schema.validate(event, { abortEarly: false, allowUnknown: true })

  if (validationResult.error) {
    throw new Error(`Event is invalid, ${validationResult.error.message}`)
  }
}
