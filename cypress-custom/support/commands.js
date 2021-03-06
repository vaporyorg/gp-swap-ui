Cypress.Commands.add('swapSelectInput', tokenAddress => {
  cy.get('#swap-currency-input .open-currency-select-button').click()
  cy.get('.token-item-' + tokenAddress).should('be.visible')
  cy.get('.token-item-' + tokenAddress).click({ force: true })
})

function _responseHandlerFactory(body) {
  return req =>
    req.reply(res => {
      const newBody = JSON.stringify(body || res.body)
      res.body = newBody
    })
}

Cypress.Commands.add('stubResponse', ({ url, alias = 'stubbedResponse', body }) => {
  cy.route2({ method: 'GET', url }, _responseHandlerFactory(body)).as(alias)
})
