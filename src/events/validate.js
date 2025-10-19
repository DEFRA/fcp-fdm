export async function validateEvent (event, eventType) {
  const schema = await import(`./schemas/${eventType}.js`)

  const validationResult = schema.default.validate(event, { abortEarly: false, allowUnknown: true })

  if (validationResult.error) {
    throw new Error(`Event is invalid, ${validationResult.error.message}`)
  }
}
