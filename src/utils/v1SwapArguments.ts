//import { MaxUint256 } from '@ethersproject/constants'
import { ETHER, SwapParameters, Token, Trade, TradeType } from 'uniswap-xdai-sdk'
import { getTradeVersion } from '../data/V1'
import { Version } from '../hooks/useToggledVersion'

/**
 * Get the arguments to make for a swap
 * @param trade trade to get v1 arguments for swapping
 * @param options options for swapping
 */
export default function v1SwapArguments(
  trade: Trade,
  options: Omit<number, 'feeOnTransfer'>
): SwapParameters {
  if (getTradeVersion(trade) !== Version.v1) {
    throw new Error('invalid trade version')
  }
  if (trade.route.pairs.length > 2) {
    throw new Error('too many pairs')
  }
  const isExactIn = trade.tradeType === TradeType.EXACT_INPUT
  const inputETH = trade.inputAmount.currency === ETHER
  const outputETH = trade.outputAmount.currency === ETHER
  if (inputETH && outputETH) throw new Error('ETHER to ETHER')
  const minimumAmountOut = `0x2`
  const maximumAmountIn = `0x1`
  const deadline = `0x1`
  if (isExactIn) {
    if (inputETH) {
      return {
        methodName: 'ethToTokenTransferInput',
        args: [minimumAmountOut, deadline],
        value: maximumAmountIn
      }
    } else if (outputETH) {
      return {
        methodName: 'tokenToEthTransferInput',
        args: [maximumAmountIn, minimumAmountOut, deadline],
        value: '0x0'
      }
    } else {
      const outputToken = trade.outputAmount.currency
      // should never happen, needed for type check
      if (!(outputToken instanceof Token)) {
        throw new Error('token to token')
      }
      return {
        methodName: 'tokenToTokenTransferInput',
        args: [maximumAmountIn, minimumAmountOut, '0x1', deadline, outputToken.address],
        value: '0x0'
      }
    }
  } else {
    if (inputETH) {
      return {
        methodName: 'ethToTokenTransferOutput',
        args: [minimumAmountOut, deadline],
        value: maximumAmountIn
      }
    } else if (outputETH) {
      return {
        methodName: 'tokenToEthTransferOutput',
        args: [minimumAmountOut, maximumAmountIn, deadline],
        value: '0x0'
      }
    } else {
      const output = trade.outputAmount.currency
      if (!(output instanceof Token)) {
        throw new Error('invalid output amount currency')
      }

      return {
        methodName: 'tokenToTokenTransferOutput',
        args: [
          minimumAmountOut,
          maximumAmountIn,
          deadline,
          output.address
        ],
        value: '0x0'
      }
    }
  }
}
