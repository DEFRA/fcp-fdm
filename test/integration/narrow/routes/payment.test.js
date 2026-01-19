import { constants as httpConstants } from 'node:http2'
import { describe, test, beforeEach, afterEach, vi, expect } from 'vitest'

const { HTTP_STATUS_OK, HTTP_STATUS_NOT_FOUND } = httpConstants

vi.mock('../../../../src/events/polling.js', () => ({
  startPolling: vi.fn(),
  stopPolling: vi.fn()
}))

const mockGetPayments = vi.fn()
const mockGetPaymentByCorrelationId = vi.fn()

vi.mock('../../../../src/projections/payment.js', () => ({
  getPayments: mockGetPayments,
  getPaymentByCorrelationId: mockGetPaymentByCorrelationId
}))

const { createServer } = await import('../../../../src/server.js')

let server

beforeEach(async () => {
  vi.resetAllMocks()

  mockGetPayments.mockResolvedValue({ payments: ['payment1', 'payment2'], total: 2, pages: 1 })
  mockGetPaymentByCorrelationId.mockResolvedValue('payment1')

  server = await createServer()
  await server.initialize()
})

afterEach(async () => {
  await server.stop()
})

describe('GET /api/v1/payments', () => {
  test('should get all payments if no query parameters are provided', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should filter payments by FRN if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?frn=1234567890'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ frn: 1234567890, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should filter payments by SBI if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?sbi=123456789'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ sbi: 123456789, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should filter payments by schemeId if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?schemeId=1'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ schemeId: 1, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should filter payments by scheme if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?scheme=SFI'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ scheme: 'SFI', includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should filter payments by vendor if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?vendor=VENDOR-A'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ vendor: 'VENDOR-A', includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should filter payments by trader if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?trader=TRADER-X'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ trader: 'TRADER-X', includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should filter payments by FRN and SBI if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?frn=1234567890&sbi=123456789'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ frn: 1234567890, sbi: 123456789, includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should filter payments by multiple criteria', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?frn=1234567890&schemeId=1&vendor=VENDOR-A'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ frn: 1234567890, schemeId: 1, vendor: 'VENDOR-A', includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should include events if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?includeEvents=true'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ includeEvents: true, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should pass page and pageSize query params to getPayments', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments?page=2&pageSize=5'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ includeEvents: false, page: 2, pageSize: 5 })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({ data: { payments: ['payment1', 'payment2'] } }))
  })

  test('should include correct links in response', async () => {
    mockGetPayments.mockResolvedValueOnce({
      payments: ['payment1', 'payment2'],
      total: 10,
      pages: 5
    })
    const options = {
      method: 'GET',
      url: '/api/v1/payments?page=2&pageSize=2'
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
    mockGetPayments.mockResolvedValueOnce({
      payments: ['payment1', 'payment2']
    })
    const options = {
      method: 'GET',
      url: '/api/v1/payments?page=2&pageSize=2'
    }
    const response = await server.inject(options)
    const payload = JSON.parse(response.payload)

    expect(payload.meta).toEqual({
      page: 2,
      pageSize: 2
    })
  })

  test('should return 504 if database operation times out', async () => {
    mockGetPayments.mockRejectedValueOnce(new Error('operation exceeded time limit'))

    const options = {
      method: 'GET',
      url: '/api/v1/payments'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(504)
    expect(JSON.parse(response.payload).message).toBe('Operation timed out')
  })

  test('should return 500 for other errors', async () => {
    mockGetPayments.mockRejectedValueOnce(new Error('Some other database error'))

    const options = {
      method: 'GET',
      url: '/api/v1/payments'
    }
    const response = await server.inject(options)

    expect(mockGetPayments).toHaveBeenCalledWith({ includeEvents: false, page: 1, pageSize: 20 })
    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.payload).message).toBe('An internal server error occurred')
  })
})

describe('GET /api/v1/payments/{correlationId}', () => {
  test('should get payment by correlationId', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetPaymentByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { payment: 'payment1' } }))
  })

  test('should return 404 if payment not found', async () => {
    mockGetPaymentByCorrelationId.mockResolvedValueOnce(null)

    const options = {
      method: 'GET',
      url: '/api/v1/payments/123e4567-e89b-12d3-a456-426614174999'
    }
    const response = await server.inject(options)

    expect(mockGetPaymentByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174999', { includeEvents: false })
    expect(response.statusCode).toBe(HTTP_STATUS_NOT_FOUND)
    expect(response.payload).equals(JSON.stringify({ error: 'Payment not found with correlationId: 123e4567-e89b-12d3-a456-426614174999' }))
  })

  test('should include events if requested', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments/123e4567-e89b-12d3-a456-426614174000?includeEvents=true'
    }
    const response = await server.inject(options)

    expect(mockGetPaymentByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: true })
    expect(response.statusCode).toBe(HTTP_STATUS_OK)
    expect(response.payload).equals(JSON.stringify({ data: { payment: 'payment1' } }))
  })

  test('should return 504 if database operation times out', async () => {
    mockGetPaymentByCorrelationId.mockRejectedValueOnce(new Error('operation exceeded time limit'))

    const options = {
      method: 'GET',
      url: '/api/v1/payments/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetPaymentByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(504)
    expect(JSON.parse(response.payload).message).toBe('Operation timed out')
  })

  test('should return 500 for other errors', async () => {
    mockGetPaymentByCorrelationId.mockRejectedValueOnce(new Error('Some other database error'))

    const options = {
      method: 'GET',
      url: '/api/v1/payments/123e4567-e89b-12d3-a456-426614174000'
    }
    const response = await server.inject(options)

    expect(mockGetPaymentByCorrelationId).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { includeEvents: false })
    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.payload).message).toBe('An internal server error occurred')
  })

  test('should validate correlationId is a valid GUID', async () => {
    const options = {
      method: 'GET',
      url: '/api/v1/payments/invalid-guid'
    }
    const response = await server.inject(options)

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.payload).message).toContain('must be a valid GUID')
  })
})
