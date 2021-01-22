import { ChainId, Token, TokenAmount } from '@uniswap/sdk'
import { parseUnits } from 'ethers/lib/utils'
import { determineFee, DetermineFee } from './testUtils'

const expirationDate = new Date(Date.now() + 300000).toISOString()
const inputCurrency = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18)

const toInputPrecision = (amt: number | string) => parseUnits(amt.toString(), inputCurrency.decimals).toString()

const ZERO_INPUT = new TokenAmount(inputCurrency, toInputPrecision('0'))
const ONE_K_INPUT = new TokenAmount(inputCurrency, toInputPrecision('1000'))
const TWO_K_INPUT = new TokenAmount(inputCurrency, toInputPrecision('2000'))
const ONE_M_INPUT = new TokenAmount(inputCurrency, toInputPrecision('1000000'))

describe('Fee calculation', () => {
  describe('No amount, no variable fee', () => {
    it('No fees neither, feeAmount = 0 // undefined', () => {
      const given: DetermineFee = {
        inputAmount: ZERO_INPUT,
        feeInformation: { minimalFee: '0', feeRatio: 0, expirationDate }
      }
      const expected = undefined
      expect(determineFee(given)).toEqual(expected)
    })

    it('With feeRatio, feeAmount still 0 // undefined', () => {
      const given: DetermineFee = {
        inputAmount: ZERO_INPUT,
        feeInformation: { minimalFee: '0', feeRatio: 10, expirationDate }
      }
      const expected = undefined
      expect(determineFee(given)).toEqual(expected)
    })

    it('With minimal fee, feeAmount is equal to the minimal fee', () => {
      const given: DetermineFee = {
        inputAmount: ZERO_INPUT,
        feeInformation: { minimalFee: '1', feeRatio: 0, expirationDate }
      }
      const expected = given.feeInformation.minimalFee
      expect(determineFee(given)?.toExact()).toEqual(expected)
    })

    it('With feeRatio and minimal fee, feeAmount is equal to the minimal fee', () => {
      const given: DetermineFee = {
        inputAmount: ZERO_INPUT,
        feeInformation: { minimalFee: '1', feeRatio: 10, expirationDate }
      }
      const expected = given.feeInformation.minimalFee
      expect(determineFee(given)?.toExact()).toEqual(expected)
    })
  })

  describe('With amount', () => {
    it('No fees neither, feeAmount = 0 // undefined', () => {
      const given: DetermineFee = {
        inputAmount: ONE_M_INPUT,
        feeInformation: { minimalFee: '0', feeRatio: 0, expirationDate }
      }
      const expected = undefined
      expect(determineFee(given)).toEqual(expected)
    })

    it('With feeRatio, feeAmount is defined by the volume and fee ratio', () => {
      const given: DetermineFee = {
        inputAmount: ONE_M_INPUT, // 1M
        feeInformation: {
          minimalFee: '0',
          feeRatio: 10, // 0.1%
          expirationDate
        }
      }
      const expected = ONE_K_INPUT // 1K
      expect(determineFee(given)).toEqual(expected)
    })

    it('With feeRatio and a small minimalFee, feeAmount is defined by the volume and fee ratio', () => {
      const given: DetermineFee = {
        inputAmount: ONE_M_INPUT, // 1M
        feeInformation: {
          minimalFee: '500', // 0.5K
          feeRatio: 10, // 0.1%
          expirationDate
        }
      }
      const expected = ONE_K_INPUT // 1K
      expect(determineFee(given)).toEqual(expected)
    })

    it('With feeRatio and a big minimalFee, feeAmount is defined by the volume and fee ratio', () => {
      const given: DetermineFee = {
        inputAmount: ONE_M_INPUT, // 1M
        feeInformation: {
          minimalFee: '2000', // 1.5K
          feeRatio: 10, // 0.1%
          expirationDate
        }
      }
      const expected = TWO_K_INPUT // 2K
      expect(determineFee(given)).toEqual(expected)
    })
  })
})
