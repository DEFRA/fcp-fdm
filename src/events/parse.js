export function parseEvent (event) {
  return JSON.parse(JSON.parse(event.Body).Message)
}
