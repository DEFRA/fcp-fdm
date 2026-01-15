import { BaseRepository } from './base-repository.js'

const messageRepository = new BaseRepository('messages', {
  transformIdField: 'correlationId',
  baseProjectionFields: {
    _id: 1,
    crn: 1,
    sbi: 1,
    status: 1,
    created: 1,
    lastUpdated: 1
  }
})

export async function getMessageByCorrelationId (correlationId, options = {}) {
  const { includeContent = false, includeEvents = false } = options
  const additionalFields = includeContent ? ['recipient', 'subject', 'body'] : []

  return messageRepository.findOne(
    { _id: correlationId },
    { includeEvents, additionalFields }
  )
}

export async function getMessages (filters = {}) {
  const { includeContent = false, includeEvents = false } = filters
  const additionalFields = includeContent ? ['recipient', 'subject', 'body'] : []

  const messages = await messageRepository.findMany(filters, {
    includeEvents,
    additionalFields
  })

  return { messages }
}
