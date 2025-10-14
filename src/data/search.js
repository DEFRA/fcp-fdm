import Fuse from 'fuse.js'
import { getAllPayments } from './database.js'
import {
  applyFiltersAndGroupByPayee,
  getFilterOptions,
  groupByPayee,
  removeKeys
} from './filters.js'

const options = {
  includeScore: true,
  threshold: 0.3,
  ignoreLocation: true,
  useExtendedSearch: false,
  keys: ['payee_name', 'part_postcode', 'town', 'county_council']
}

const suggestionResultsLimit = 6

async function getPaymentData ({
  searchString,
  limit,
  offset,
  sortBy,
  filterBy,
  action
}) {
  const searchResults = await searchAllPayments(searchString)
  const filteredResults = applyFiltersAndGroupByPayee(searchResults, filterBy)

  if (!filteredResults.length) {
    return {
      count: 0,
      rows: [],
      filterOptions: getFilterOptions(searchResults)
    }
  }

  const sortedResults = sortResults(filteredResults, sortBy)

  return {
    count: filteredResults.length,
    rows:
      action === 'download'
        ? sortedResults
        : sortedResults.slice(offset, offset + limit),
    filterOptions: getFilterOptions(searchResults)
  }
}

async function getSearchSuggestions (searchString) {
  const searchResults = await searchAllPayments(searchString)
  const groupedResults = groupByPayee(searchResults)
  return {
    count: groupedResults.length,
    rows: groupedResults
      .map((result) =>
        removeKeys(result, ['scheme', 'total_amount', 'financial_year'])
      )
      .slice(0, suggestionResultsLimit)
  }
}

async function searchAllPayments (searchString) {
  const payments = await getAllPayments()
  const fuse = new Fuse(payments, options)
  return fuse.search(searchString).map((result) => result.item)
}

function sortResults (results, sortBy) {
  if (sortBy !== 'score' && options.keys.includes(sortBy)) {
    return results.sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : -1))
  }
  return results
}

export { getPaymentData, getSearchSuggestions }
