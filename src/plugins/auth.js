import { config } from '../config.js'

const issuer = `https://login.microsoftonline.com/${config.get('auth.tenant')}/v2.0`
const jwksUri = `https://login.microsoftonline.com/${config.get('auth.tenant')}/discovery/v2.0/keys`

const allowedGroupIds = config.get('auth.allowedGroupIds') || []

export const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      if (config.get('auth.enabled')) {
        server.auth.strategy('entra', 'jwt', getAuthOptions())

        // All routes will require authentication unless explicitly set to `auth: false`
        server.auth.default('entra')
      }
    }
  }
}

function getAuthOptions () {
  return {
    keys: jwksUri,
    verify: {
      aud: false, // Disable audience verification for now
      sub: false, // Disable subject verification for now
      iss: [issuer],
      nbf: true,
      exp: true
    },
    validate: async (artifacts, _request, _h) => {
      const { payload } = artifacts.decoded

      if (payload.typ && payload.typ !== 'JWT' && payload.typ !== 'at+jwt') {
        return { isValid: false, errorMessage: 'Provided token is not an access token' }
      }

      const tokenGroups = Array.isArray(payload.groups) ? payload.groups : []

      if (allowedGroupIds.length > 0 && tokenGroups.some(group => allowedGroupIds.includes(group))) {
        return { isValid: true, credentials: { token: payload, principalId: payload.sub } }
      }

      return { isValid: false, errorMessage: 'Provided token does not belong to a supported Security Group' }
    }
  }
}
