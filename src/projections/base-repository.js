import { getMongoDb } from '../common/helpers/mongodb.js'
import { config } from '../config/config.js'

const maxTimeMS = config.get('mongo.maxTimeMS')

/**
 * Base repository for MongoDB projections with common query, projection, and transformation logic.
 * Provides reusable methods for filtering, pagination, and document transformation.
 */
export class BaseRepository {
  /**
   * Creates a new BaseRepository instance
   * @param {string} collectionName - MongoDB collection name
   * @param {Object} [options={}] - Repository configuration options
   * @param {Object} [options.baseProjectionFields] - Base fields to include in all queries
   * @param {string} [options.transformIdField] - Custom field name to map MongoDB _id to (e.g., 'correlationId')
   */
  constructor (collectionName, options = {}) {
    this.collectionName = collectionName
    this.baseProjectionFields = options.baseProjectionFields || {
      _id: 1,
      crn: 1,
      sbi: 1,
      status: 1,
      created: 1,
      lastUpdated: 1
    }
    this.transformIdField = options.transformIdField || null
  }

  /**
   * Gets the MongoDB collection instance
   * @returns {Collection} MongoDB collection
   */
  getCollection () {
    const { collections } = getMongoDb()
    return collections[this.collectionName]
  }

  /**
   * Builds MongoDB query from filters
   * @param {Object} [filters={}] - Filter parameters
   * @param {string} [filters.crn] - Customer Reference Number
   * @param {string} [filters.sbi] - Single Business Identifier
   * @returns {Object} MongoDB query object
   */
  buildQuery (filters = {}) {
    const { crn, sbi } = filters
    const query = {}

    if (crn !== undefined) {
      query.crn = crn
    }
    if (sbi !== undefined) {
      query.sbi = sbi
    }

    return query
  }

  /**
   * Builds MongoDB projection object for field selection
   * @param {Object} [options={}] - Projection options
   * @param {string[]} [options.additionalFields] - Additional fields to include beyond base fields
   * @param {boolean} [options.includeEvents] - Whether to include events array
   * @returns {Object} MongoDB projection object
   */
  buildProjection (options = {}) {
    const projection = { ...this.baseProjectionFields }

    // Add resource-specific fields
    if (options.additionalFields?.length) {
      const additionalProjection = options.additionalFields.reduce((acc, field) => {
        acc[field] = 1
        return acc
      }, {})
      Object.assign(projection, additionalProjection)
    }

    if (options.includeEvents) {
      projection.events = 1
    }

    return projection
  }

  /**
   * Transforms MongoDB _id from nested event objects
   * @param {Array} events - Array of event objects
   * @returns {Array} Events with _id removed
   * @private
   */
  transformEvents (events) {
    return events.map(({ _id: _mongoId, ...event }) => event)
  }

  /**
   * Transforms MongoDB document to application domain model
   * @param {Object|null} doc - MongoDB document
   * @param {Object} [options={}] - Transformation options
   * @param {boolean} [options.includeEvents] - Whether events should be transformed
   * @returns {Object|null} Transformed document or null
   */
  transformDocument (doc, options = {}) {
    if (!doc) return null

    const { _id, ...rest } = doc
    const transformed = { ...rest }

    // Handle custom ID field transformation (e.g., correlationId)
    if (this.transformIdField) {
      transformed[this.transformIdField] = _id
    }

    // Transform events if present
    if (options.includeEvents && transformed.events) {
      transformed.events = this.transformEvents(transformed.events)
    }

    return transformed
  }

  /**
   * Finds a single document matching the filter
   * @param {Object} filter - MongoDB filter query
   * @param {Object} [options={}] - Query options (additionalFields, includeEvents)
   * @returns {Promise<Object|null>} Transformed document or null if not found
   */
  async findOne (filter, options = {}) {
    const collection = this.getCollection()
    const projection = this.buildProjection(options)

    const doc = await collection.findOne(
      filter,
      { projection, readPreference: 'secondaryPreferred', maxTimeMS }
    )

    return this.transformDocument(doc, options)
  }

  /**
   * Finds multiple documents with pagination and filtering
   * @param {Object} [filters={}] - Filter and pagination parameters
   * @param {string} [filters.crn] - Customer Reference Number
   * @param {string} [filters.sbi] - Single Business Identifier
   * @param {number} [filters.page=1] - Page number (1-based)
   * @param {number} [filters.pageSize=20] - Number of documents per page
   * @param {Object} [options={}] - Query options (additionalFields, includeEvents)
   * @returns {Promise<Array>} Array of transformed documents
   */
  async findMany (filters = {}, options = {}) {
    const collection = this.getCollection()
    const { page = 1, pageSize = 20 } = filters

    const query = this.buildQuery(filters)
    const projection = this.buildProjection(options)

    const cursor = collection.find(query, {
      projection,
      sort: { created: -1, _id: -1 },
      readPreference: 'secondaryPreferred',
      maxTimeMS
    })
      .skip((page - 1) * pageSize)
      .limit(pageSize)

    const docs = await cursor.toArray()

    return docs.map(doc => this.transformDocument(doc, options))
  }
}
