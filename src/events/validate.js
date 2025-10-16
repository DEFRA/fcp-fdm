import schema from './schema.js'

function isEventValid (event) {
  const validationResult = schema.validate(event, { abortEarly: false, allowUnknown: true })
  return !validationResult.error
}

export { isEventValid }
