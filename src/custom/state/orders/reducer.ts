import { createReducer, PayloadAction } from '@reduxjs/toolkit'
import { OrderID } from 'utils/operator'
import { ChainId } from '@uniswap/sdk'
import {
  addPendingOrder,
  removeOrder,
  Order,
  clearOrders,
  fulfillOrder,
  OrderStatus,
  updateLastCheckedBlock,
  expireOrder,
  fulfillOrdersBatch,
  expireOrdersBatch
} from './actions'
import { ContractDeploymentBlocks } from './consts'
import { Writable } from '@src/custom/types'

export interface OrderObject {
  id: OrderID
  order: Order
}

// {order uuid => OrderObject} mapping
type OrdersMap = Record<OrderID, OrderObject>
export type PartialOrdersMap = Partial<OrdersMap>

export type OrdersState = {
  readonly [chainId in ChainId]?: {
    pending: PartialOrdersMap
    fulfilled: PartialOrdersMap
    expired: PartialOrdersMap
    lastCheckedBlock: number
  }
}

export interface PrefillStateRequired {
  chainId: ChainId
}

// makes sure there's always an object at state[chainId], state[chainId].pending | .fulfilled
function prefillState(
  state: Writable<OrdersState>,
  { payload: { chainId } }: PayloadAction<PrefillStateRequired>
): asserts state is Required<OrdersState> {
  // asserts that state[chainId].pending | .fulfilled | .expired is ok to access
  const stateAtChainId = state[chainId]

  if (!stateAtChainId) {
    state[chainId] = {
      pending: {},
      fulfilled: {},
      expired: {},
      lastCheckedBlock: ContractDeploymentBlocks[chainId] ?? 0
    }
    return
  }

  if (!stateAtChainId.pending) {
    stateAtChainId.pending = {}
  }

  if (!stateAtChainId.fulfilled) {
    stateAtChainId.fulfilled = {}
  }

  if (!stateAtChainId.expired) {
    stateAtChainId.expired = {}
  }

  if (stateAtChainId.lastCheckedBlock === undefined) {
    stateAtChainId.lastCheckedBlock = ContractDeploymentBlocks[chainId] ?? 0
  }
}

const initialState: OrdersState = {}

export default createReducer(initialState, builder =>
  builder
    .addCase(addPendingOrder, (state, action) => {
      prefillState(state, action)
      const { order, id, chainId } = action.payload

      state[chainId].pending[id] = { order, id }
    })
    .addCase(removeOrder, (state, action) => {
      prefillState(state, action)
      const { id, chainId } = action.payload
      delete state[chainId].pending[id]
      delete state[chainId].fulfilled[id]
      delete state[chainId].expired[id]
    })
    .addCase(fulfillOrder, (state, action) => {
      prefillState(state, action)
      const { id, chainId, fulfillmentTime, transactionHash } = action.payload

      const orderObject = state[chainId].pending[id]

      if (orderObject) {
        delete state[chainId].pending[id]

        orderObject.order.status = OrderStatus.FULFILLED
        orderObject.order.fulfillmentTime = fulfillmentTime

        orderObject.order.fulfilledTransactionHash = transactionHash

        state[chainId].fulfilled[id] = orderObject
      }
    })
    .addCase(fulfillOrdersBatch, (state, action) => {
      prefillState(state, action)
      const { ordersData, chainId, lastCheckedBlock } = action.payload

      // update lastCheckedBlock
      state[chainId].lastCheckedBlock = lastCheckedBlock

      const pendingOrders = state[chainId].pending
      const fulfilledOrders = state[chainId].fulfilled

      // if there are any newly fulfilled orders
      // update them
      ordersData.forEach(({ id, fulfillmentTime, transactionHash }) => {
        const orderObject = pendingOrders[id]

        if (orderObject) {
          delete pendingOrders[id]

          orderObject.order.status = OrderStatus.FULFILLED
          orderObject.order.fulfillmentTime = fulfillmentTime

          orderObject.order.fulfilledTransactionHash = transactionHash

          fulfilledOrders[id] = orderObject
        }
      })
    })
    .addCase(expireOrder, (state, action) => {
      prefillState(state, action)
      const { id, chainId } = action.payload

      const orderObject = state[chainId].pending[id]

      if (orderObject) {
        delete state[chainId].pending[id]

        orderObject.order.status = OrderStatus.EXPIRED

        state[chainId].expired[id] = orderObject
      }
    })
    .addCase(expireOrdersBatch, (state, action) => {
      prefillState(state, action)
      const { ids, chainId } = action.payload

      const pendingOrders = state[chainId].pending
      const fulfilledOrders = state[chainId].expired

      // if there are any newly fulfilled orders
      // update them
      ids.forEach(id => {
        const orderObject = pendingOrders[id]

        if (orderObject) {
          delete pendingOrders[id]

          orderObject.order.status = OrderStatus.EXPIRED
          fulfilledOrders[id] = orderObject
        }
      })
    })
    .addCase(clearOrders, (state, action) => {
      const { chainId } = action.payload

      const lastCheckedBlock = state[chainId]?.lastCheckedBlock

      state[chainId] = {
        pending: {},
        fulfilled: {},
        expired: {},
        lastCheckedBlock: lastCheckedBlock ?? ContractDeploymentBlocks[chainId] ?? 0
      }
    })
    .addCase(updateLastCheckedBlock, (state, action) => {
      prefillState(state, action)
      const { chainId, lastCheckedBlock } = action.payload

      state[chainId].lastCheckedBlock = lastCheckedBlock
    })
)
