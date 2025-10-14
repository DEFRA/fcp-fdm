const health = {
  method: 'GET',
  path: '/health',
  options: {
    description: 'Health check endpoint',
    notes: 'Returns a simple success message to indicate the service is running',
    tags: ['api', 'health']
  },
  handler: (_request, h) => h.response({ message: 'success' })
}

export { health }
