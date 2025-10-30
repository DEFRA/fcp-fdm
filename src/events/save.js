import { save as messageSaver } from './save/message.js'

const savers = {
  message: messageSaver
}

export async function saveEvent (event, eventType) {
  const save = savers[eventType]
  await save(event)
}
