import { health } from '../routes/health.js'
import { messages } from '../routes/messages.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route(
        [].concat(
          health,
          messages
        )
      )
    }
  }
}

export { router }
