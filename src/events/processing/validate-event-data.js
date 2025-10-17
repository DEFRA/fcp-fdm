export async function validateEventData (eventData, eventType) {
  const schema = await import(`./schemas/${eventType}`)
  const validationResult = schema.validate(eventData, { abortEarly: false, allowUnknown: true })
  if (validationResult.error) {
    const error = new Error(`Event data is invalid, ${validationResult.error.message}`)
    error.category = 'validation'
    throw error
  }
}
