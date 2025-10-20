import { constants as httpConstants } from 'node:http2'
import { describe, test, beforeEach, afterEach, vi, expect } from 'vitest'

const { HTTP_STATUS_OK, HTTP_STATUS_NOT_FOUND } = httpConstants

vi.mock('../../../../src/events/polling.js', () => ({
  pollForEvents: vi.fn()
}))

const mockGetMessages = vi.fn()
const mockGetMessageByCorrelationId = vi.fn()

vi.mock('../../../../src/projections/messages.js', () => ({
  getMessages: mockGetMessages,
  getMessageByCorrelationId: mockGetMessageByCorrelationId
}))

const { createServer } = await import('../../../../src/server.js')

let server

beforeEach(async () => {
  vi.resetAllMocks()

  mockGetMessages.mockResolvedValue(['message1', 'message2'])
  mockGetMessageByCorrelationId.mockResolvedValue('message1')

  server = await createServer()
  await server.initialize()
})

afterEach(async () => {
  await server.stop()
})

describe('GET /api/v1/messages', () => {
  test('should get all messages if no query parameters are provided', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages'
    }
    const response = await server.inject(options)

    expect(mockGetMessages).toHaveBeenCalledWith({ includeContent: false, includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { messages: ['message1', 'message2'] } }))
  })

  test('should filter messages by CRN if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages?crn=1234567890'
    }
    const response = await server.inject(options)

    expect(mockGetMessages).toHaveBeenCalledWith({ crn: 1234567890, includeContent: false, includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { messages: ['message1', 'message2'] } }))
  })

  test('should filter messages by SBI if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages?sbi=123456789'
    }
    const response = await server.inject(options)

    expect(mockGetMessages).toHaveBeenCalledWith({ sbi: 123456789, includeContent: false, includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { messages: ['message1', 'message2'] } }))
  })

  test('should filter messages by CRN and SBI if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages?crn=1234567890&sbi=123456789'
    }
    const response = await server.inject(options)

    expect(mockGetMessages).toHaveBeenCalledWith({ crn: 1234567890, sbi: 123456789, includeContent: false, includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { messages: ['message1', 'message2'] } }))
  })

  test('should include content if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages?includeContent=true'
    }
    const response = await server.inject(options)

    expect(mockGetMessages).toHaveBeenCalledWith({ includeContent: true, includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { messages: ['message1', 'message2'] } }))
  })

  test('should include events if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages?includeEvents=true'
    }
    const response = await server.inject(options)

    expect(mockGetMessages).toHaveBeenCalledWith({ includeContent: false, includeEvents: true })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { messages: ['message1', 'message2'] } }))
  })
})

describe('GET /api/v1/messages/{correlationId}', () => {
  test('should get message by correlationId', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetMessageByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeContent: false, includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { message: 'message1' } }))
  })

  test('should return 404 if message not found', async () => {
    mockGetMessageByCorrelationId.mockResolvedValueOnce(null)

    const options = {
      method: 'GET',
      url: '/api/v1/messages/123e4567-e89b-12d3-a456-426614174999'
    }
    const response = await server.inject(options)

    expect(mockGetMessageByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174999', { includeContent: false, includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_NOT_FOUND)
    expect(response.payload).equals(JSON.stringify({ error: 'Message not found with correlationId: 123e4567-e89b-12d3-a456-426614174999' }))
  })

  test('should include content if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages/123e4567-e89b-12d3-a456-426614174000?includeContent=true'
    }
    const response = await server.inject(options)

    expect(mockGetMessageByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeContent: true, includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { message: 'message1' } }))
  })

  test('should include events if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/messages/123e4567-e89b-12d3-a456-426614174000?includeEvents=true'
    }
    const response = await server.inject(options)

    expect(mockGetMessageByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeContent: false, includeEvents: true })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { message: 'message1' } }))
  })
})
