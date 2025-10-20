import { describe, test, beforeEach, afterEach, vi, expect } from 'vitest'

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

describe('message routes', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    server = await createServer()
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop()
  })

  test('GET /health should return 200', async () => {
    const options = {
      method: 'GET',
      url: '/health'
    }
    const response = await server.inject(options)
    expect(response.statusCode).toBe(200)
  })

  test('GET /health should return "ok" response', async () => {
    const options = {
      method: 'GET',
      url: '/health'
    }
    const response = await server.inject(options)
    expect(JSON.parse(response.payload).message).toBe('success')
  })
})
