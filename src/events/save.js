import { save as messageSaver } from './save/message.js'
import { save as noSave } from './save/no-save.js'

const savers = {
  message: messageSaver,
  messageRejected: noSave
}

export async function saveEvent (event, eventType) {
  const save = savers[eventType]
  await save(event)
}
