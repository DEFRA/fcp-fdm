import { save as messageSaver } from './save/message.js'
import { save as noSave } from './save/no-save.js'
import { config } from '../config/config.js'

const savers = {
  message: messageSaver,
  messageRejected: noSave
}

export async function saveEvent (event, eventType) {
  if (!config.get('data.enabled')) {
    await noSave(event)
    return
  }

  const save = savers[eventType]
  await save(event)
}
