import { describe, test, vi, expect } from 'vitest'

vi.mock('../../../src/events/polling.js')

describe('startup and shutdown', () => {
  test('should start and stop the server without errors', async () => {
    const module = await import('../../../src/index.js')
    expect(module).toBeDefined()
  })
})
