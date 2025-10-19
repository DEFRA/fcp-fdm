export async function saveEvent (event, eventType) {
  const { save } = await import(`./save/${eventType}.js`)
  await save(event)
}
