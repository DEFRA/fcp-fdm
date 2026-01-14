import { constants as httpConstants } from 'node:http2'
import { describe, test, beforeEach, afterEach, vi, expect } from 'vitest'

const { HTTP_STATUS_OK, HTTP_STATUS_NOT_FOUND } = httpConstants

vi.mock('../../../../src/events/polling.js', () => ({
  startPolling: vi.fn(),
  stopPolling: vi.fn()
}))

const mockGetCrmCases = vi.fn()
const mockGetCrmByCaseId = vi.fn()

vi.mock('../../../../src/projections/crm.js', () => ({
  getCrmCases: mockGetCrmCases,
  getCrmByCaseId: mockGetCrmByCaseId
}))

const { createServer } = await import('../../../../src/server.js')

let server

beforeEach(async () => {
  vi.resetAllMocks()

  mockGetCrmCases.mockResolvedValue({ crmCases: ['crmCase1', 'crmCase2'], total: 2, pages: 1 })
  mockGetCrmByCaseId.mockResolvedValue('crmCase1')

  server = await createServer()
  await server.initialize()
})

afterEach(async () => {
  await server.stop()
})

describe('GET /api/v1/crm', () => {
  test('should get all CRM cases if no query parameters are provided', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/crm'
    }
    const response = await server.inject(options)

    expect(mockGetCrmCases).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { crmCases: ['crmCase1', 'crmCase2'] } }))
  })

  test('should filter CRM cases by CRN if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/crm?crn=1234567890'
    }
    const response = await server.inject(options)

    expect(mockGetCrmCases).toHaveBeenCalledWith({ crn: 1234567890, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { crmCases: ['crmCase1', 'crmCase2'] } }))
  })

  test('should filter CRM cases by SBI if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/crm?sbi=123456789'
    }
    const response = await server.inject(options)

    expect(mockGetCrmCases).toHaveBeenCalledWith({ sbi: 123456789, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { crmCases: ['crmCase1', 'crmCase2'] } }))
  })

  test('should filter CRM cases by CRN and SBI if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/crm?crn=1234567890&sbi=123456789'
    }
    const response = await server.inject(options)

    expect(mockGetCrmCases).toHaveBeenCalledWith({ crn: 1234567890, sbi: 123456789, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { crmCases: ['crmCase1', 'crmCase2'] } }))
  })

  test('should include events if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/crm?includeEvents=true'
    }
    const response = await server.inject(options)

    expect(mockGetCrmCases).toHaveBeenCalledWith({ includeEvents: true, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { crmCases: ['crmCase1', 'crmCase2'] } }))
  })

  test('should pass page and pageSize query params to getCrmCases', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/crm?page=2&pageSize=5'
    }
    const response = await server.inject(options)

    expect(mockGetCrmCases).toHaveBeenCalledWith({ includeEvents: false, page: 2, pageSize: 5 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { crmCases: ['crmCase1', 'crmCase2'] } }))
  })

  test('should include correct links in response', async () => {
    mockGetCrmCases.mockResolvedValueOnce({
      crmCases: ['crmCase1', 'crmCase2'],
      total: 10,
      pages: 5
    })
    const options = {
      method: 'GET',
      url: '/api/v1/crm?page=2&pageSize=2'
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
    mockGetCrmCases.mockResolvedValueOnce({
      crmCases: ['crmCase1', 'crmCase2']
    })
    const options = {
      method: 'GET',
      url: '/api/v1/crm?page=2&pageSize=2'
    }
    const response = await server.inject(options)
    const payload = JSON.parse(response.payload)

    expect(payload.meta).toEqual({
      page: 2,
      pageSize: 2
    })
  })

  test('should return 504 if database operation times out', async () => {
    mockGetCrmCases.mockRejectedValueOnce(new Error('operation exceeded time limit'))

    const options = {
      method: 'GET',
      url: '/api/v1/crm'
    }
    const response = await server.inject(options)

    expect(mockGetCrmCases).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(504)
    expect(JSON.parse(response.payload).message).toBe('Operation timed out')
  })

  test('should return 500 for other errors', async () => {
    mockGetCrmCases.mockRejectedValueOnce(new Error('Some other database error'))

    const options = {
      method: 'GET',
      url: '/api/v1/crm'
    }
    const response = await server.inject(options)

    expect(mockGetCrmCases).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.payload).message).toBe('An internal server error occurred')
  })
})

describe('GET /api/v1/crm/{caseId}', () => {
  test('should get CRM case by caseId', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/crm/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetCrmByCaseId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { crmCase: 'crmCase1' } }))
  })

  test('should return 404 if CRM case not found', async () => {
    mockGetCrmByCaseId.mockResolvedValueOnce(null)

    const options = {
      method: 'GET',
      url: '/api/v1/crm/123e4567-e89b-12d3-a456-426614174999'
    }
    const response = await server.inject(options)

    expect(mockGetCrmByCaseId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174999', { includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_NOT_FOUND)
    expect(response.payload).equals(JSON.stringify({ error: 'CRM case not found with caseId: 123e4567-e89b-12d3-a456-426614174999' }))
  })

  test('should include events if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/crm/123e4567-e89b-12d3-a456-426614174000?includeEvents=true'
    }
    const response = await server.inject(options)

    expect(mockGetCrmByCaseId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: true })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { crmCase: 'crmCase1' } }))
  })

  test('should return 504 if database operation times out', async () => {
    mockGetCrmByCaseId.mockRejectedValueOnce(new Error('operation exceeded time limit'))

    const options = {
      method: 'GET',
      url: '/api/v1/crm/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetCrmByCaseId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(504)
    expect(JSON.parse(response.payload).message).toBe('Operation timed out')
  })

  test('should return 500 for other errors', async () => {
    mockGetCrmByCaseId.mockRejectedValueOnce(new Error('Some other database error'))

    const options = {
      method: 'GET',
      url: '/api/v1/crm/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetCrmByCaseId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.payload).message).toBe('An internal server error occurred')
  })
})
