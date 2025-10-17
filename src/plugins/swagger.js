import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import HapiSwagger from 'hapi-swagger'

const swaggerOptions = {
  info: {
    title: 'FCP Farming Data Model'
  }
}

const swagger = [
  Inert,
  Vision,
  {
    plugin: HapiSwagger,
    options: swaggerOptions
  }
]

export { swagger }
