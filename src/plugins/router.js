import { health } from '../routes/health.js'
import { payments } from '../routes/payments.js'
import { paymentsSearch } from '../routes/payments-search.js'
import { paymentsSummary } from '../routes/payments-summary.js'
import { paymentsPayee } from '../routes/payments-payee.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route(
        [].concat(
          health,
          payments,
          paymentsSearch,
          paymentsSummary,
          paymentsPayee
        )
      )
    }
  }
}

export { router }
