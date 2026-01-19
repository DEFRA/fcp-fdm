import { describe, expect, test } from 'vitest'
import { convertToPence } from '../../../../src/common/helpers/currency.js'

describe('convertToPence', () => {
  describe('valid numeric inputs', () => {
    test.each([
      [100, 10000],
      [100.00, 10000],
      [-100, -10000],
      [100.10, 10010],
      [100.1, 10010]
    ])('converts %p to %p pence', (input, expected) => {
      expect(convertToPence(input)).toEqual(expected)
    })
  })

  describe('valid string inputs', () => {
    test.each([
      ['100', 10000],
      ['100.00', 10000],
      ['100.10', 10010],
      ['100.1', 10010]
    ])('converts "%s" to %p pence', (input, expected) => {
      expect(convertToPence(input)).toEqual(expected)
    })
  })

  describe('invalid inputs', () => {
    test.each([undefined, null, {}, [], true, false, Boolean()])(
      'returns undefined for %p',
      input => {
        expect(convertToPence(input)).toBeUndefined()
      }
    )
  })
})
