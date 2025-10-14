import { expect, test, describe, beforeEach, afterAll, vi } from 'vitest'

describe('config', () => {
  const PROCESS_ENV = process.env

  beforeEach(() => {
    vi.resetModules()

    process.env = { ...PROCESS_ENV }

    process.env.NODE_ENV = 'test'

    process.env.HOST = '1.1.1.1'
    process.env.PORT = '6000'
    process.env.SERVICE_VERSION = '1.0.0'
    process.env.ENVIRONMENT = 'dev'
    process.env.LOG_ENABLED = 'true'
    process.env.LOG_LEVEL = 'debug'
    process.env.LOG_FORMAT = 'ecs'
    process.env.HTTP_PROXY = 'http://proxy:8080'
    process.env.ENABLE_SECURE_CONTEXT = 'true'
    process.env.ENABLE_METRICS = 'true'
    process.env.TRACING_HEADER = 'x-custom-trace-id'
  })

  afterAll(() => {
    process.env = { ...PROCESS_ENV }
  })

  test('should return host from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('host')).toBe('1.1.1.1')
  })

  test('should default host to 0.0.0.0 if not provided in environment variable', async () => {
    delete process.env.HOST
    const { config } = await import('../../src/config.js')
    expect(config.get('host')).toBe('0.0.0.0')
  })

  test('should throw error if host is not an IP address', async () => {
    process.env.HOST = 'invalid-ip-address'
    await expect(async () => await import('../../src/config.js')).rejects.toThrow()
  })

  test('should return port from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('port')).toBe(6000)
  })

  test('should default port to 3000 if not provided in environment variable', async () => {
    delete process.env.PORT
    const { config } = await import('../../src/config.js')
    expect(config.get('port')).toBe(3000)
  })

  test('should throw error if port is not a number', async () => {
    process.env.PORT = 'invalid-port'
    await expect(async () => await import('../../src/config.js')).rejects.toThrow()
  })

  test('should throw error if port is not a valid port number', async () => {
    process.env.PORT = '99999'
    await expect(async () => await import('../../src/config.js')).rejects.toThrow()
  })

  test('should return service name with default value', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('serviceName')).toBe('fcp-fdm')
  })

  test('should return service version from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('serviceVersion')).toBe('1.0.0')
  })

  test('should return null service version if not provided in environment variable', async () => {
    delete process.env.SERVICE_VERSION
    const { config } = await import('../../src/config.js')
    expect(config.get('serviceVersion')).toBeNull()
  })

  test('should return cdp environment from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('cdpEnvironment')).toBe('dev')
  })

  test('should default cdp environment to local if not provided in environment variable', async () => {
    delete process.env.ENVIRONMENT
    const { config } = await import('../../src/config.js')
    expect(config.get('cdpEnvironment')).toBe('local')
  })

  test('should return log enabled from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('log.isEnabled')).toBe(true)
  })

  test('should default log enabled to true for non-test environments', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.LOG_ENABLED
    const { config } = await import('../../src/config.js')
    expect(config.get('log.isEnabled')).toBe(true)
  })

  test('should return log level from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('log.level')).toBe('debug')
  })

  test('should default log level to info if not provided in environment variable', async () => {
    delete process.env.LOG_LEVEL
    const { config } = await import('../../src/config.js')
    expect(config.get('log.level')).toBe('info')
  })

  test('should return log format from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('log.format')).toBe('ecs')
  })

  test('should default log format to pino-pretty for non-production environments', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.LOG_FORMAT
    const { config } = await import('../../src/config.js')
    expect(config.get('log.format')).toBe('pino-pretty')
  })

  test('should return http proxy from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('httpProxy')).toBe('http://proxy:8080')
  })

  test('should return null http proxy if not provided in environment variable', async () => {
    delete process.env.HTTP_PROXY
    const { config } = await import('../../src/config.js')
    expect(config.get('httpProxy')).toBeNull()
  })

  test('should return secure context enabled from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('isSecureContextEnabled')).toBe(true)
  })

  test('should default secure context enabled to false for non-production environments', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ENABLE_SECURE_CONTEXT
    const { config } = await import('../../src/config.js')
    expect(config.get('isSecureContextEnabled')).toBe(false)
  })

  test('should return metrics enabled from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('isMetricsEnabled')).toBe(true)
  })

  test('should default metrics enabled to false for non-production environments', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ENABLE_METRICS
    const { config } = await import('../../src/config.js')
    expect(config.get('isMetricsEnabled')).toBe(false)
  })

  test('should return tracing header from environment variable', async () => {
    const { config } = await import('../../src/config.js')
    expect(config.get('tracing.header')).toBe('x-custom-trace-id')
  })

  test('should default tracing header to x-cdp-request-id if not provided in environment variable', async () => {
    delete process.env.TRACING_HEADER
    const { config } = await import('../../src/config.js')
    expect(config.get('tracing.header')).toBe('x-cdp-request-id')
  })
})
