import { saveMessageEvent } from './message.js'

export async function saveEvent (event, eventType) {
  switch (eventType) {
    case 'message':
      await saveMessageEvent(event)
      break
    default:
      throw new Error(`Unknown event type: ${eventType}`)
  }
}
