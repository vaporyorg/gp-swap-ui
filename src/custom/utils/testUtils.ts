import { Currency, CurrencyAmount, Token, TokenAmount, JSBI, Percent } from '@uniswap/sdk'
import { parseUnits } from 'ethers/lib/utils'
import { FeeInformation } from './operator'

// converts a basis points value to a sdk percent
export function basisPointsToPercent(num: number): Percent {
  return new Percent(JSBI.BigInt(num), JSBI.BigInt(10000))
}

export function tryParseAmount(value?: string, currency?: Currency): CurrencyAmount | undefined {
  if (!value || !currency) {
    return undefined
  }
  try {
    const typedValueParsed = parseUnits(value, currency.decimals).toString()
    if (typedValueParsed !== '0') {
      return currency instanceof Token
        ? new TokenAmount(currency, JSBI.BigInt(typedValueParsed))
        : CurrencyAmount.ether(JSBI.BigInt(typedValueParsed))
    }
  } catch (error) {
    // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
    console.debug(`Failed to parse input amount: "${value}"`, error)
  }
  // necessary for all paths to return a value
  return undefined
}

export interface DetermineFee {
  inputAmount: CurrencyAmount
  feeInformation: FeeInformation
}

/**
 * DetermineFee
 * @description using the inputAmount, compares whether the minimalFee or the feeRatio is greater and returns
 * @description accepts fractional values
 */
export function determineFee({ feeInformation, inputAmount }: DetermineFee): CurrencyAmount | undefined {
  const { feeRatio, minimalFee } = feeInformation

  // We need to consider some cases here:
  // Case 1: No feeInformation - return null
  // Case 2: No feeRatio, but minimalFee
  //   Case2a: is minimalFee >= inputAmount? - return null
  //   Case2b: minimalFee < inputAmount - return fee
  // Case 3: feeRatio && minimalFee
  //  Case 3a: feeRatio * inputAmount > minimalFee - return feeRatio
  //  Case 3b: feeRatio * inputAmount <= minimalFee - return minimalFee
  //  Case 3c: feeRatio exists && minimalFee > inputAmount - return feeRatio

  // MINIMAL FEE
  const minimalFeeAsCurrency = tryParseAmount(minimalFee, inputAmount.currency)

  // FEE_RATIO AS PERCENT
  const feeRatioAmount = inputAmount.multiply(basisPointsToPercent(feeRatio))
  const feeRatioAsCurrency = tryParseAmount(
    feeRatioAmount.toSignificant(inputAmount.currency.decimals),
    inputAmount.currency
  )

  if (minimalFeeAsCurrency && feeRatioAsCurrency) {
    // Which is bigger? feeRatio * inputAmount OR the minimalFee?
    return feeRatioAsCurrency.greaterThan(minimalFeeAsCurrency) ? feeRatioAsCurrency : minimalFeeAsCurrency
  } else {
    // One or neither is valid, return that one
    return minimalFeeAsCurrency || feeRatioAsCurrency
  }
}
