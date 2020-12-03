import { Field } from '@src/state/swap/actions'
import { Currency, CurrencyAmount, Trade } from '@uniswap/sdk'
import { useDerivedSwapInfo as useDerivedSwapInfoUniswap } from '@src/state/swap/hooks'

export {
  useDefaultsFromURLSearch,
  useDerivedSwapInfo as useDerivedSwapInfoUniswap,
  useSwapActionHandlers,
  useSwapState
} from '@src/state/swap/hooks'

// from the current swap inputs, compute the best trade and return it.
export function useDerivedSwapInfo(): {
  currencies: { [field in Field]?: Currency }
  currencyBalances: { [field in Field]?: CurrencyAmount }
  parsedAmount: CurrencyAmount | undefined
  v2Trade: Trade | undefined
  inputError?: string
  v1Trade: Trade | undefined
} {
  return useDerivedSwapInfoUniswap()
}
