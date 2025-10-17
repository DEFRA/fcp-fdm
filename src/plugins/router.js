import { health } from '../routes/health.js'
import { events } from '../routes/events.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route(
        [].concat(
          health,
          events
        )
      )
    }
  }
}

export { router }
