import { Middleware, isAnyOf } from '@reduxjs/toolkit'

import { addPopup } from 'state/application/actions'
import { AppState } from 'state'
import * as OrderActions from './actions'

import { OrderIDWithPopup, OrderTxTypes, PopupPayload, setPopupData } from './helpers'

// action syntactic sugar
const isSingleOrderChangeAction = isAnyOf(
  OrderActions.addPendingOrder,
  OrderActions.expireOrder,
  OrderActions.fulfillOrder
)
const isPendingOrderAction = isAnyOf(OrderActions.addPendingOrder)
const isFulfillOrderAction = isAnyOf(OrderActions.fulfillOrder)
const isBatchOrderAction = isAnyOf(OrderActions.fulfillOrdersBatch, OrderActions.expireOrdersBatch)
const isBatchFulfillOrderAction = isAnyOf(OrderActions.fulfillOrdersBatch)

// on each Pending, Expired, Fulfilled order action
// a corresponsing Popup action is dispatched
export const popupMiddleware: Middleware<{}, AppState> = store => next => action => {
  const result = next(action)

  let idsAndPopups: OrderIDWithPopup[] = []
  //  is it a singular action with {chainId, id} payload
  if (isSingleOrderChangeAction(action)) {
    const { id, chainId } = action.payload

    // use current state to lookup orders' data
    const orders = store.getState().orders[chainId]

    if (!orders) return

    const { pending, fulfilled, expired } = orders

    const orderObject = pending?.[id] || fulfilled?.[id] || expired?.[id]

    // look up Order.summary for Popup
    const summary = orderObject?.order.summary

    let popup: PopupPayload
    if (isPendingOrderAction(action)) {
      // Pending Order Popup
      popup = setPopupData(OrderTxTypes.METATXN, { summary, status: 'submitted', id })
    } else if (isFulfillOrderAction(action)) {
      const { transactionHash: hash } = action.payload

      popup = setPopupData(OrderTxTypes.TXN, {
        hash,
        summary,
        id,
        status: OrderActions.OrderStatus.FULFILLED,
        descriptor: 'was traded'
      })
    } else {
      // action is order/expireOrder
      // Expired Order Popup
      popup = setPopupData(OrderTxTypes.METATXN, {
        success: false,
        summary,
        id,
        status: OrderActions.OrderStatus.EXPIRED
      })
    }

    idsAndPopups.push({
      id,
      popup
    })
  } else if (isBatchOrderAction(action)) {
    const { chainId } = action.payload

    // use current state to lookup orders' data
    const orders = store.getState().orders[chainId]

    if (!orders) return

    const { pending, fulfilled, expired } = orders

    if (isBatchFulfillOrderAction(action)) {
      // construct Fulfilled Order Popups for each Order
      idsAndPopups = action.payload.ordersData.map(({ id, transactionHash }) => {
        const orderObject = pending?.[id] || fulfilled?.[id] || expired?.[id]
        const summary = orderObject?.order.summary

        const popup = setPopupData(OrderTxTypes.TXN, {
          hash: transactionHash,
          summary,
          id,
          status: OrderActions.OrderStatus.FULFILLED,
          descriptor: 'was traded'
        })

        return { id, popup }
      })
    } else {
      // construct Expired Order Popups for each Order
      idsAndPopups = action.payload.ids.map(id => {
        const orderObject = pending?.[id] || fulfilled?.[id] || expired?.[id]

        const summary = orderObject?.order.summary

        const popup = setPopupData(OrderTxTypes.METATXN, {
          success: false,
          summary,
          id,
          status: OrderActions.OrderStatus.EXPIRED
        })

        return { id, popup }
      })
    }
  }

  // dispatch all necessary Popups
  // empty if for unrelated actions
  idsAndPopups.forEach(({ popup }) => {
    store.dispatch(addPopup(popup))
  })

  return result
}
