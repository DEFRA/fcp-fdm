import { BaseRepository } from './base-repository.js'

class PaymentRepository extends BaseRepository {
  constructor () {
    super('payments', {
      transformIdField: 'correlationId',
      baseProjectionFields: {
        _id: 1,
        frn: 1,
        sbi: 1,
        schemeId: 1,
        vendor: 1,
        trader: 1,
        invoiceNumber: 1,
        paymentRequests: 1,
        status: 1,
        created: 1,
        lastUpdated: 1
      }
    })
  }

  /**
   * Builds MongoDB query from filters for payments
   * @param {Object} [filters={}] - Filter parameters
   * @param {number} [filters.frn] - Farm Reference Number
   * @param {number} [filters.sbi] - Single Business Identifier
   * @param {number} [filters.schemeId] - Scheme identifier
   * @param {string} [filters.scheme] - Scheme name
   * @param {string} [filters.vendor] - Vendor identifier
   * @param {string} [filters.trader] - Trader identifier
   * @returns {Object} MongoDB query object
   */
  buildQuery (filters = {}) {
    const query = super.buildQuery(filters)
    const { schemeId, scheme, vendor, trader, frn } = filters

    if (frn !== undefined) {
      query.frn = frn
    }
    if (schemeId !== undefined) {
      query.schemeId = schemeId
    }
    if (scheme !== undefined) {
      query.scheme = scheme
    }
    if (vendor !== undefined) {
      query.vendor = vendor
    }
    if (trader !== undefined) {
      query.trader = trader
    }

    return query
  }
}

const paymentRepository = new PaymentRepository()

export async function getPaymentByCorrelationId (correlationId, options = {}) {
  return paymentRepository.findOne(
    { _id: correlationId },
    { includeEvents: options.includeEvents }
  )
}

export async function getPayments (filters = {}) {
  const payments = await paymentRepository.findMany(filters, { includeEvents: filters.includeEvents })
  return { payments }
}
