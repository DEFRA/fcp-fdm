import { getPaymentSummary, getPaymentSummaryCsv } from '../data/summary.js'

const paymentsSummary = [
  {
    method: 'GET',
    path: '/v1/payments/summary',
    options: {
      description: 'Get payment summary by scheme and year',
      notes: 'Returns aggregated payment data grouped by scheme and year',
      tags: ['api', 'payments']
    },
    handler: async (_request, h) => {
      const payments = await getPaymentSummary()
      return h.response(payments)
    }
  },
  {
    method: 'GET',
    path: '/v1/payments/summary/file',
    options: {
      description: 'Download payment summary as CSV',
      notes: 'Returns payment summary data as a downloadable CSV file',
      tags: ['api', 'payments']
    },
    handler: async (_request, h) => {
      const paymentsCsv = await getPaymentSummaryCsv()
      return h
        .response(paymentsCsv)
        .type('text/csv')
        .header(
          'Content-Disposition',
          'attachment;filename=ffc-payments-by-year.csv'
        )
    }
  }
]

export { paymentsSummary }
