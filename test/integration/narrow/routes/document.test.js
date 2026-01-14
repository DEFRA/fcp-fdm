import { constants as httpConstants } from 'node:http2'
import { describe, test, beforeEach, afterEach, vi, expect } from 'vitest'

const { HTTP_STATUS_OK, HTTP_STATUS_NOT_FOUND } = httpConstants

vi.mock('../../../../src/events/polling.js', () => ({
  startPolling: vi.fn(),
  stopPolling: vi.fn()
}))

const mockGetDocuments = vi.fn()
const mockGetDocumentByFileId = vi.fn()

vi.mock('../../../../src/projections/documents.js', () => ({
  getDocuments: mockGetDocuments,
  getDocumentByFileId: mockGetDocumentByFileId
}))

const { createServer } = await import('../../../../src/server.js')

let server

beforeEach(async () => {
  vi.resetAllMocks()

  mockGetDocuments.mockResolvedValue({ documents: ['document1', 'document2'], total: 2, pages: 1 })
  mockGetDocumentByFileId.mockResolvedValue('document1')

  server = await createServer()
  await server.initialize()
})

afterEach(async () => {
  await server.stop()
})

describe('GET /api/v1/documents', () => {
  test('should get all documents if no query parameters are provided', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/documents'
    }
    const response = await server.inject(options)

    expect(mockGetDocuments).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { documents: ['document1', 'document2'] } }))
  })

  test('should filter documents by CRN if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/documents?crn=1234567890'
    }
    const response = await server.inject(options)

    expect(mockGetDocuments).toHaveBeenCalledWith({ crn: 1234567890, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { documents: ['document1', 'document2'] } }))
  })

  test('should filter documents by SBI if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/documents?sbi=123456789'
    }
    const response = await server.inject(options)

    expect(mockGetDocuments).toHaveBeenCalledWith({ sbi: 123456789, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { documents: ['document1', 'document2'] } }))
  })

  test('should filter documents by CRN and SBI if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/documents?crn=1234567890&sbi=123456789'
    }
    const response = await server.inject(options)

    expect(mockGetDocuments).toHaveBeenCalledWith({ crn: 1234567890, sbi: 123456789, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { documents: ['document1', 'document2'] } }))
  })

  test('should include events if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/documents?includeEvents=true'
    }
    const response = await server.inject(options)

    expect(mockGetDocuments).toHaveBeenCalledWith({ includeEvents: true, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { documents: ['document1', 'document2'] } }))
  })

  test('should pass page and pageSize query params to getDocuments', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/documents?page=2&pageSize=5'
    }
    const response = await server.inject(options)

    expect(mockGetDocuments).toHaveBeenCalledWith({ includeEvents: false, page: 2, pageSize: 5 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { documents: ['document1', 'document2'] } }))
  })

  test('should include correct links in response', async () => {
    mockGetDocuments.mockResolvedValueOnce({
      documents: ['document1', 'document2'],
      total: 10,
      pages: 5
    })
    const options = {
      method: 'GET',
      url: '/api/v1/documents?page=2&pageSize=2'
    }
    const response = await server.inject(options)
    const payload = JSON.parse(response.payload)

    expect(payload.links).toEqual(expect.objectContaining({
      self: expect.any(String),
      first: expect.any(String),
      prev: expect.any(String),
      next: expect.any(String)
    }))
  })

  test('should include correct meta in response', async () => {
    mockGetDocuments.mockResolvedValueOnce({
      documents: ['document1', 'document2']
    })
    const options = {
      method: 'GET',
      url: '/api/v1/documents?page=2&pageSize=2'
    }
    const response = await server.inject(options)
    const payload = JSON.parse(response.payload)

    expect(payload.meta).toEqual({
      page: 2,
      pageSize: 2
    })
  })

  test('should return 504 if database operation times out', async () => {
    mockGetDocuments.mockRejectedValueOnce(new Error('operation exceeded time limit'))

    const options = {
      method: 'GET',
      url: '/api/v1/documents'
    }
    const response = await server.inject(options)

    expect(mockGetDocuments).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(504)
    expect(JSON.parse(response.payload).message).toBe('Operation timed out')
  })

  test('should return 500 for other errors', async () => {
    mockGetDocuments.mockRejectedValueOnce(new Error('Some other database error'))

    const options = {
      method: 'GET',
      url: '/api/v1/documents'
    }
    const response = await server.inject(options)

    expect(mockGetDocuments).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.payload).message).toBe('An internal server error occurred')
  })
})

describe('GET /api/v1/documents/{fileId}', () => {
  test('should get document by fileId', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/documents/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetDocumentByFileId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { document: 'document1' } }))
  })

  test('should return 404 if document not found', async () => {
    mockGetDocumentByFileId.mockResolvedValueOnce(null)

    const options = {
      method: 'GET',
      url: '/api/v1/documents/123e4567-e89b-12d3-a456-426614174999'
    }
    const response = await server.inject(options)

    expect(mockGetDocumentByFileId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174999', { includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_NOT_FOUND)
    expect(response.payload).equals(JSON.stringify({ error: 'Document not found with fileId: 123e4567-e89b-12d3-a456-426614174999' }))
  })

  test('should include events if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/documents/123e4567-e89b-12d3-a456-426614174000?includeEvents=true'
    }
    const response = await server.inject(options)

    expect(mockGetDocumentByFileId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: true })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { document: 'document1' } }))
  })

  test('should return 504 if database operation times out', async () => {
    mockGetDocumentByFileId.mockRejectedValueOnce(new Error('operation exceeded time limit'))

    const options = {
      method: 'GET',
      url: '/api/v1/documents/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetDocumentByFileId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(504)
    expect(JSON.parse(response.payload).message).toBe('Operation timed out')
  })

  test('should return 500 for other errors', async () => {
    mockGetDocumentByFileId.mockRejectedValueOnce(new Error('Some other database error'))

    const options = {
      method: 'GET',
      url: '/api/v1/documents/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetDocumentByFileId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.payload).message).toBe('An internal server error occurred')
  })
})
