const events = {
  method: 'GET',
  path: '/v1/events',
  options: {
    description: 'Events',
    notes: 'Returns all events',
    tags: ['api', 'events']
  },
  handler: async (request, h) => {
    const allEvents = await request.db.collection('events-temp').find({}).toArray()
    return h.response({ data: { events: allEvents } })
  }
}

export { events }
