import { getTip } from '@src/custom/utils/price'
import { useActiveWeb3React } from '@src/hooks'
import { useCurrency } from '@src/hooks/Tokens'
import { useTradeExactIn, useTradeExactOut } from '@src/hooks/Trades'
import useENS from '@src/hooks/useENS'
import { Field } from '@src/state/swap/actions'
import { tryParseAmount, useSwapState } from '@src/state/swap/hooks'
import { useUserSlippageTolerance } from '@src/state/user/hooks'
import { useCurrencyBalances } from '@src/state/wallet/hooks'
import { isAddress } from '@src/utils'
import { computeSlippageAdjustedAmounts } from '@src/utils/prices'
import { Currency, CurrencyAmount, JSBI, Token, TokenAmount, Trade } from '@uniswap/sdk'

export * from '@src/state/swap/hooks'

const BAD_RECIPIENT_ADDRESSES: string[] = [
  '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // v2 factory
  '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a', // v2 router 01
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' // v2 router 02
]

/**
 * Returns true if any of the pairs or tokens in a trade have the given checksummed address
 * @param trade to check for the given address
 * @param checksummedAddress address to check in the pairs and tokens
 */
function involvesAddress(trade: Trade, checksummedAddress: string): boolean {
  return (
    trade.route.path.some(token => token.address === checksummedAddress) ||
    trade.route.pairs.some(pair => pair.liquidityToken.address === checksummedAddress)
  )
}

function tryValueToCurrency(value?: string, currency?: Currency): CurrencyAmount | undefined {
  if (!value || !currency) {
    return undefined
  }
  try {
    if (value !== '0') {
      return currency instanceof Token ? new TokenAmount(currency, value) : CurrencyAmount.ether(value)
    }
  } catch (error) {
    // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
    console.debug(`Failed to parse input amount: "${value}"`, error)
  }
  // necessary for all paths to return a value
  return undefined
}

function calculateTipInOrOut({
  parsedAmount,
  feeForTradeExactIn,
  feeForTradeExactOut,
  currencyByInput,
  isExactIn
}: TradeCalculation & {
  feeForTradeExactIn: CurrencyAmount | undefined
  feeForTradeExactOut: CurrencyAmount | undefined
}): CurrencyAmount | undefined {
  if (!parsedAmount) return undefined

  const computedTip = isExactIn ? feeForTradeExactIn : feeForTradeExactOut

  if (!computedTip) return parsedAmount

  return tryValueToCurrency(
    // PARSED_USER_AMOUNT - FEE_AMOUNT
    JSBI[isExactIn ? 'subtract' : 'add'](parsedAmount.raw, computedTip.raw).toString(),
    currencyByInput
  )
}

interface TradeCalculation {
  currencyByInput?: Currency
  inputCurrency?: Currency | null
  outputCurrency?: Currency | null
  parsedAmount?: CurrencyAmount
  isExactIn: boolean
}

const useTradeWithTip = ({
  currencyByInput,
  inputCurrency,
  outputCurrency,
  isExactIn,
  parsedAmount
}: TradeCalculation) => {
  const tip = getTip()
  const parsedFeeAmount = tryParseAmount(tip, inputCurrency || undefined)

  // Shows fee amount in OUTPUT token
  const feeForTradeExactIn = useTradeExactIn(isExactIn ? parsedFeeAmount : undefined, outputCurrency ?? undefined)
    ?.inputAmount
  // Shows fee amount in INPUT token
  const feeForTradeExactOut = useTradeExactOut(outputCurrency ?? undefined, !isExactIn ? parsedFeeAmount : undefined)
    ?.inputAmount

  const tipAmount = calculateTipInOrOut({
    parsedAmount,
    feeForTradeExactIn,
    feeForTradeExactOut,
    isExactIn,
    currencyByInput
  })

  const bestTradeExactIn = useTradeExactIn(tipAmount, outputCurrency ?? undefined)
  const bestTradeExactOut = useTradeExactOut(inputCurrency ?? undefined, tipAmount)

  return {
    bestTradeExactIn,
    bestTradeExactOut
  }
}

interface DerivedSwapInfo {
  currencies: { [field in Field]?: Currency }
  currencyBalances: { [field in Field]?: CurrencyAmount }
  parsedAmount: CurrencyAmount | undefined
  v2Trade: Trade | undefined
  // TODO: review this - we don't use a v1 trade but changing all code
  // or extending whole swap comp for only removing v1trade is a lot
  v1Trade: undefined
  inputError?: string
}

// from the current swap inputs, compute the best trade and return it.
export function useDerivedSwapInfo(): DerivedSwapInfo {
  const { account } = useActiveWeb3React()

  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
    recipient
  } = useSwapState()

  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)
  const recipientLookup = useENS(recipient ?? undefined)
  const to: string | null = (recipient === null ? account : recipientLookup.address) ?? null

  const relevantTokenBalances = useCurrencyBalances(account ?? undefined, [
    inputCurrency ?? undefined,
    outputCurrency ?? undefined
  ])

  const isExactIn: boolean = independentField === Field.INPUT

  const currencyByInput = (isExactIn ? inputCurrency : outputCurrency) ?? undefined

  const parsedAmount = tryParseAmount(typedValue, currencyByInput)

  const { bestTradeExactIn, bestTradeExactOut } = useTradeWithTip({
    isExactIn,
    currencyByInput,
    inputCurrency,
    outputCurrency,
    parsedAmount
  })

  const trade = isExactIn ? bestTradeExactIn : bestTradeExactOut

  const currencyBalances = {
    [Field.INPUT]: relevantTokenBalances[0],
    [Field.OUTPUT]: relevantTokenBalances[1]
  }

  const currencies: { [field in Field]?: Currency } = {
    [Field.INPUT]: inputCurrency ?? undefined,
    [Field.OUTPUT]: outputCurrency ?? undefined
  }

  let inputError: string | undefined
  if (!account) {
    inputError = 'Connect Wallet'
  }

  if (!parsedAmount) {
    inputError = inputError ?? 'Enter an amount'
  }

  if (!currencies[Field.INPUT] || !currencies[Field.OUTPUT]) {
    inputError = inputError ?? 'Select a token'
  }

  const formattedTo = isAddress(to)
  if (!to || !formattedTo) {
    inputError = inputError ?? 'Enter a recipient'
  } else {
    if (
      BAD_RECIPIENT_ADDRESSES.indexOf(formattedTo) !== -1 ||
      (bestTradeExactIn && involvesAddress(bestTradeExactIn, formattedTo)) ||
      (bestTradeExactOut && involvesAddress(bestTradeExactOut, formattedTo))
    ) {
      inputError = inputError ?? 'Invalid recipient'
    }
  }

  const [allowedSlippage] = useUserSlippageTolerance()

  const slippageAdjustedAmounts = trade && allowedSlippage && computeSlippageAdjustedAmounts(trade, allowedSlippage)

  // compare input balance to max input based on version
  const [balanceIn, amountIn] = [
    currencyBalances[Field.INPUT],
    slippageAdjustedAmounts ? slippageAdjustedAmounts[Field.INPUT] : null
  ]

  if (balanceIn && amountIn && balanceIn.lessThan(amountIn)) {
    inputError = 'Insufficient ' + amountIn.currency.symbol + ' balance'
  }

  return {
    currencies,
    currencyBalances,
    parsedAmount,
    v2Trade: trade ?? undefined,
    v1Trade: undefined,
    inputError
  }
}
