import { save as noSave } from './save/no-save.js'
import { save as messageSaver } from './save/message.js'
import { save as documentSaver } from './save/document.js'
import { save as crmSaver } from './save/crm.js'
import { save as paymentSaver } from './save/payment.js'
import { config } from '../config/config.js'

const savers = {
  message: messageSaver,
  messageRejected: noSave,
  document: documentSaver,
  crm: crmSaver,
  payment: paymentSaver
}

export async function saveEvent (event, eventType) {
  if (!config.get('data.enabled')) {
    await noSave(event)
    return
  }

  const save = savers[eventType]
  await save(event)
}
