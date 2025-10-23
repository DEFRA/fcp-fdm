import { config } from '../config.js'

const tenant = config.get('auth.tenant')
const allowedGroupIds = config.get('auth.allowedGroupIds') || []

export const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      if (config.get('auth.enabled')) {
        server.auth.strategy('entra', 'jwt', getAuthOptions())

        // All routes will require authentication unless explicitly set to `auth: false`
        server.auth.default('entra')

        // TODO: Temporary extension to catch authentication errors
        server.ext('onPreResponse', (request, h) => {
          const response = request.response

          if (response.isBoom && response.output.statusCode === 401) {
            console.error('🔒 Authentication Error Details:')
            console.error('- Status:', response.output.statusCode)
            console.error('- Message:', response.message)
            console.error('- Headers:', JSON.stringify(request.headers, null, 2))
            console.error('- Auth Info:', request.auth)
            console.error('- Full Error:', response)
          }

          return h.continue
        })
      }
    }
  }
}

function getAuthOptions () {
  return {
    keys: {
      uri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`
    },
    verify: {
      aud: false,
      sub: false,
      iss: [`https://sts.windows.net/${tenant}/`, `https://login.microsoftonline.com/${tenant}/v2.0`], // Accept both v1.0 and v2.0 tokens
      nbf: true,
      exp: true
    },
    validate: async (artifacts, _request, _h) => {
      const { payload } = artifacts.decoded

      if (payload.typ && payload.typ !== 'JWT' && payload.typ !== 'at+jwt') {
        console.log('Invalid token type:', payload.typ)
        return { isValid: false, errorMessage: 'Provided token is not an access token' }
      }

      const tokenGroups = Array.isArray(payload.groups) ? payload.groups : []

      if (allowedGroupIds.length > 0) {
        return { isValid: false, errorMessage: 'No authorized security groups configured' }
      }

      if (!tokenGroups.some(group => allowedGroupIds.includes(group))) {
        return { isValid: false, errorMessage: 'Token does not belong to an authorized Security Group' }
      }

      const credentials = {
        token: payload,
        principalId: payload.sub
      }

      return { isValid: true, credentials }
    }
  }
}
