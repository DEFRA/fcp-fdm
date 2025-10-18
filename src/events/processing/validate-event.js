import schema from './schemas/event.js'

export function validateEvent (event) {
  const validationResult = schema.validate(event, { abortEarly: false, allowUnknown: true })
  if (validationResult.error) {
    throw new Error(`Event is invalid, ${validationResult.error.message}`)
  }
}

export async function validateEventData (eventData, eventType) {
  const dataSchema = await import(`./schemas/${eventType}.js`)
  const validationResult = dataSchema.default.validate(eventData, { abortEarly: false, allowUnknown: true })
  if (validationResult.error) {
    throw new Error(`Event data is invalid, ${validationResult.error.message}`)
  }
}
