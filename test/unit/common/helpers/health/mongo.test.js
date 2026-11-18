import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockCreateMongoDbConnection = vi.fn()
const mockCommand = vi.fn()
const mockLogInfo = vi.fn()
const mockLogError = vi.fn()

vi.mock('../../../../../src/common/helpers/mongodb.js', () => ({
  createMongoDbConnection: mockCreateMongoDbConnection,
  getMongoDb: () => ({ db: { command: mockCommand } })
}))

vi.mock('../../../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ info: mockLogInfo, error: mockLogError })
}))

const { config } = await import('../../../../../src/config/config.js')
const { healthCheck } = await import('../../../../../src/common/helpers/health/mongo.js')

describe('mongo health check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMongoDbConnection.mockResolvedValue(undefined)
    mockCommand.mockResolvedValue({ ok: 1 })
  })

  test('should connect, ping and log success', async () => {
    // act
    await healthCheck()

    // assert
    expect(mockCreateMongoDbConnection).toHaveBeenCalledWith(config.get('mongo'))
    expect(mockCommand).toHaveBeenCalledWith({ ping: 1 })
    expect(mockLogInfo).toHaveBeenCalledWith('SUCCESS: Connected to MongoDB')
  })

  test('should log and rethrow when the connection fails', async () => {
    // arrange
    const error = new Error('connection refused')
    mockCreateMongoDbConnection.mockRejectedValueOnce(error)

    // act / assert
    await expect(healthCheck()).rejects.toThrow('connection refused')
    expect(mockCommand).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(error, 'Error connecting to MongoDB')
  })

  test('should log and rethrow when the ping fails', async () => {
    // arrange
    const error = new Error('ping failed')
    mockCommand.mockRejectedValueOnce(error)

    // act / assert
    await expect(healthCheck()).rejects.toThrow('ping failed')
    expect(mockLogError).toHaveBeenCalledWith(error, 'Error connecting to MongoDB')
  })
})
