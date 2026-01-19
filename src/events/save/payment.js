import { getMongoDb } from '../../common/helpers/mongodb.js'
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

  const pipeline = buildSavePipeline(event, eventEntity, {
    eventTypePrefix: PAYMENT_EVENT_PREFIX,
    dataFields,
    updateOnlyWhenNewer: true
  })

  await paymentCollection.updateOne(
    { _id: correlationId },
    pipeline,
    { upsert: true, maxTimeMS }
  )
}

function convertToPence (valueInPounds) {
  try {
    const currencyArray = valueInPounds.toString().split('.').filter(x => x.length > 0)
    const pounds = currencyArray[0]
    const pence = (currencyArray[1] ?? '00').padEnd(2, '0')
    const value = Number(pounds + pence)
    return Number.isInteger(value) ? value : undefined
  } catch {
    return undefined
  }
}
