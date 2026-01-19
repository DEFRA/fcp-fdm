import { health } from '../routes/health.js'
import { messages } from '../routes/message.js'
import { documents } from '../routes/document.js'
import { crm } from '../routes/crm.js'
import { payments } from '../routes/payment.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route(
        [].concat(
          health,
          messages,
          documents,
          crm,
          payments
        )
      )
    }
  }
}

export { router }
