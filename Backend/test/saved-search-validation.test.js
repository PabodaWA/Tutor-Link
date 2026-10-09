const test = require('node:test');
const assert = require('node:assert/strict');

const { savedSearchPayloadSchema } = require('../src/routes/saved-search.routes');

const validSearch = {
  name: 'Affordable Java tutors',
  query: 'java',
  subject: 'Java',
  sort: 'rate_low',
  filters: { minRate: 1000, maxRate: 3000, minRating: 4, availability: 'week', experience: '1-2 years' },
};

test('accepts a valid saved tutor search', () => {
  assert.equal(savedSearchPayloadSchema.safeParse(validSearch).success, true);
});

test('rejects a saved search with an inverted price range', () => {
  assert.equal(savedSearchPayloadSchema.safeParse({ ...validSearch, filters: { ...validSearch.filters, minRate: 5000, maxRate: 2000 } }).success, false);
});

test('rejects unsupported saved-search values', () => {
  assert.equal(savedSearchPayloadSchema.safeParse({ ...validSearch, sort: 'cheapest_first' }).success, false);
});
