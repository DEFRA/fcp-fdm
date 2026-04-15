import { getMongoDb } from '../../common/helpers/mongodb.js'
import { convertToPence } from '../../common/helpers/currency.js'
import { eventTypePrefixes } from '../types.js'
import { config } from '../../config/config.js'
import { saveCloudEvent } from './cloud-events.js'
import { buildSavePipeline } from './pipeline.js'

const { PAYMENT_EVENT_PREFIX } = eventTypePrefixes

const maxTimeMS = config.get('mongo.maxTimeMS')

export async function save (event) {
  const eventEntity = await saveCloudEvent(event)

  if (eventEntity) {
    await upsertPayment(event, eventEntity)
  }
}

async function upsertPayment (event, eventEntity) {
  const { collections } = getMongoDb()
  const { payments: paymentCollection } = collections

  const { correlationId } = event.data

  const dataFields = sanitizeDataFields(event)

  const topLevelFields = extractTopLevelFields(dataFields)
  const paymentRequestFields = extractPaymentRequestFields(dataFields)

  const isEnrichedType = event.type === `${PAYMENT_EVENT_PREFIX}enriched`
  const enrichedOptions = isEnrichedType ? buildEnrichedOptions(dataFields.invoiceNumber) : {}

  const pipeline = buildSavePipeline(event, eventEntity, {
    eventTypePrefix: PAYMENT_EVENT_PREFIX,
    dataFields: topLevelFields,
    updateOnlyWhenNewer: true,
    unsetFields: [
      '_incomingInvoiceNumber',
      '_incomingPaymentRequest',
      ...(enrichedOptions.additionalUnsetFields ?? [])
    ],
    beforeEventTracking: (pipe, context) => {
      addPaymentRequestStage(pipe, context, dataFields, paymentRequestFields, isEnrichedType)
    },
    prependStages: enrichedOptions.prependStages,
    afterStatusTracking: enrichedOptions.afterStatusTracking
  })

  await paymentCollection.updateOne(
    { _id: correlationId },
    pipeline,
    { upsert: true, maxTimeMS }
  )
}

function sanitizeDataFields (event) {
  const dataFields = { ...event.data }

  // Payment Hub events all have values in pence with the exception of payment.extracted
  // as this is the raw data values received from systems using batch files.
  // All of these systems use pounds as the value.
  if (event.type === 'uk.gov.defra.ffc.pay.payment.extracted') {
    if (dataFields.value !== undefined) {
      dataFields.value = convertToPence(dataFields.value)
    }

    if (Array.isArray(dataFields.invoiceLines)) {
      dataFields.invoiceLines = dataFields.invoiceLines.map(line => ({
        ...line,
        value: line.value === undefined ? line.value : convertToPence(line.value)
      }))
    }
  }

  if (INVERTED_VALUE_SCHEME_IDS.has(dataFields.schemeId) && dataFields.value !== undefined) {
    dataFields.value = -dataFields.value
  }

  return dataFields
}

function buildEnrichedOptions (invoiceNumber) {
  return {
    prependStages: [buildDuplicateDetectionStage(invoiceNumber)],
    additionalUnsetFields: ['_isDuplicateEnriched', '_originalLastUpdated', '_originalStatus'],
    afterStatusTracking (pipe) {
      pipe.push({
        $set: {
          lastUpdated: { $cond: ['$_isDuplicateEnriched', '$_originalLastUpdated', '$lastUpdated'] },
          lastEventTime: { $cond: ['$_isDuplicateEnriched', '$_prevLastEventTime', '$lastEventTime'] },
          status: { $cond: ['$_isDuplicateEnriched', '$_originalStatus', '$status'] }
        }
      })
    }
  }
}

function buildDuplicateDetectionStage (invoiceNumber) {
  return {
    $set: {
      _isDuplicateEnriched: {
        $gt: [
          {
            $indexOfArray: [
              { $ifNull: [{ $map: { input: '$paymentRequests', as: 'pr', in: '$$pr.invoiceNumber' } }, []] },
              invoiceNumber
            ]
          },
          -1
        ]
      },
      _originalLastUpdated: '$lastUpdated',
      _originalStatus: '$status'
    }
  }
}

function addPaymentRequestStage (pipeline, context, dataFields, paymentRequestFields, guardForDuplicate = false) {
  // Stage: Handle paymentRequests array - update existing or add new
  const paymentRequestsValue = buildPaymentRequestsArray(dataFields, paymentRequestFields, context)
  pipeline.push({
    $set: {
      _incomingInvoiceNumber: dataFields.invoiceNumber,
      _incomingPaymentRequest: paymentRequestFields,
      paymentRequests: guardForDuplicate
        ? { $cond: ['$_isDuplicateEnriched', '$paymentRequests', paymentRequestsValue] }
        : paymentRequestsValue
    }
  })
}

function buildPaymentRequestsArray (dataFields, paymentRequestFields, context) {
  return {
    $cond: {
      // Check if paymentRequests array exists
      if: { $ne: [{ $type: '$paymentRequests' }, 'array'] },
      // If not, create array with new payment request including lastUpdated timestamp
      then: [{ $mergeObjects: [paymentRequestFields, { lastUpdated: context.incomingTime }] }],
      // If it exists...
      else: {
        $cond: {
          // If the previous status was 'extracted' and the incoming event is newer,
          // replace the entire paymentRequests array — invoice numbers from extracted
          // events use raw batch file formats and cannot be matched against later events
          if: {
            $and: [
              { $eq: ['$status', 'extracted'] },
              { $gt: [context.incomingTime, { $ifNull: ['$lastEventTime', new Date(0)] }] }
            ]
          },
          then: [{ $mergeObjects: [paymentRequestFields, { lastUpdated: context.incomingTime }] }],
          // Otherwise, check if invoiceNumber already exists in array
          else: {
            $let: {
              vars: {
                existingIndex: {
                  $indexOfArray: [
                    { $map: { input: '$paymentRequests', as: 'pr', in: '$$pr.invoiceNumber' } },
                    dataFields.invoiceNumber
                  ]
                }
              },
              in: {
                $cond: {
                  // If invoice number exists in array
                  if: { $gte: ['$$existingIndex', 0] },
                  // Update the existing item only if incoming event is newer
                  then: updatePaymentRequestArray(paymentRequestFields, context),
                  // If invoice number doesn't exist, append to array with lastUpdated timestamp
                  else: {
                    $concatArrays: [
                      '$paymentRequests',
                      [{ $mergeObjects: [paymentRequestFields, { lastUpdated: context.incomingTime }] }]
                    ]
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

function updatePaymentRequestArray (paymentRequestFields, context) {
  return {
    $map: {
      input: { $range: [0, { $size: '$paymentRequests' }] },
      as: 'idx',
      in: {
        $cond: {
          if: { $eq: ['$$idx', '$$existingIndex'] },
          // Check if incoming event is newer than existing payment request
          then: {
            $cond: {
              if: {
                $gt: [
                  context.incomingTime,
                  { $ifNull: [{ $arrayElemAt: ['$paymentRequests.lastUpdated', '$$idx'] }, new Date(0)] }
                ]
              },
              then: { $mergeObjects: [paymentRequestFields, { lastUpdated: context.incomingTime }] },
              else: { $arrayElemAt: ['$paymentRequests', '$$idx'] }
            }
          },
          else: { $arrayElemAt: ['$paymentRequests', '$$idx'] }
        }
      }
    }
  }
}

const SCHEME_NAMES = {
  1: 'SFI',
  2: 'SFI Pilot',
  3: 'Lump Sums',
  4: 'Vet Visits',
  5: 'CS',
  6: 'BPS',
  7: 'FDMR',
  8: 'Manual',
  9: 'ES',
  10: 'FC',
  11: 'IMPS',
  12: 'SFI23',
  13: 'Delinked',
  14: 'Expanded SFI Offer',
  15: 'COHT Revenue',
  16: 'COHT Capital',
  17: 'FPTT'
}

// Some schemes now submit a header value with an inverted value
// These values will be inverted before saving aggregation object
const INVERTED_VALUE_SCHEME_IDS = new Set([
  17
])

const TOP_LEVEL_FIELD_NAMES = [
  'frn',
  'sbi',
  'correlationId',
  'schemeId',
  'agreementNumber',
  'contractNumber',
  'batch',
  'paymentRequestNumber',
  'marketingYear',
  'sourceSystem'
]

function extractTopLevelFields (dataFields) {
  const extracted = {}
  for (const field of TOP_LEVEL_FIELD_NAMES) {
    if (dataFields[field] !== undefined) {
      extracted[field] = dataFields[field]
    }
  }

  // Add scheme property based on schemeId
  if (dataFields.schemeId !== undefined) {
    extracted.scheme = SCHEME_NAMES[dataFields.schemeId]
  }

  return extracted
}

function extractPaymentRequestFields (dataFields) {
  const extracted = {}
  for (const [key, value] of Object.entries(dataFields)) {
    if (!TOP_LEVEL_FIELD_NAMES.includes(key)) {
      extracted[key] = value
    }
  }

  return extracted
}
