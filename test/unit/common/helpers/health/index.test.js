import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockMongoHealthCheck = vi.fn()
const mockSqsHealthCheck = vi.fn()
const mockLogError = vi.fn()

vi.mock('../../../../../src/common/helpers/health/mongo.js', () => ({
  healthCheck: mockMongoHealthCheck
}))

vi.mock('../../../../../src/common/helpers/health/sqs.js', () => ({
  healthCheck: mockSqsHealthCheck
}))

vi.mock('../../../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: mockLogError })
}))

const { runHealthChecks } = await import('../../../../../src/common/helpers/health/index.js')

describe('runHealthChecks', () => {
  let processExitSpy

  beforeEach(() => {
    vi.clearAllMocks()
    mockMongoHealthCheck.mockResolvedValue(undefined)
    mockSqsHealthCheck.mockResolvedValue(undefined)
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})
  })

  afterEach(() => {
    processExitSpy.mockRestore()
  })

  test('should run all registered health checks', async () => {
    // act
    await runHealthChecks()

    // assert
    expect(mockMongoHealthCheck).toHaveBeenCalledTimes(1)
    expect(mockSqsHealthCheck).toHaveBeenCalledTimes(1)
    expect(processExitSpy).not.toHaveBeenCalled()
  })

  test('should log and exit the process if the mongo check fails', async () => {
    // arrange
    const error = new Error('mongo down')
    mockMongoHealthCheck.mockRejectedValueOnce(error)

    // act
    await runHealthChecks()

    // assert
    expect(mockLogError).toHaveBeenCalledWith(error, 'Unrecoverable startup health check error, shutting down')
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  test('should log and exit the process if the sqs check fails', async () => {
    // arrange
    const error = new Error('sqs down')
    mockSqsHealthCheck.mockRejectedValueOnce(error)

    // act
    await runHealthChecks()

    // assert
    expect(mockLogError).toHaveBeenCalledWith(error, 'Unrecoverable startup health check error, shutting down')
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })
})
