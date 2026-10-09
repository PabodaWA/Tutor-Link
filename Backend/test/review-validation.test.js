const test = require('node:test');
const assert = require('node:assert/strict');

const { reviewPayloadSchema } = require('../src/routes/tutor.routes');

test('accepts a star rating without a written review', () => {
  const result = reviewPayloadSchema.safeParse({ rating: 5 });
  assert.equal(result.success, true);
  assert.equal(result.data.comment, '');
});

test('accepts a rating with an optional written review', () => {
  assert.equal(
    reviewPayloadSchema.safeParse({ rating: 4, comment: 'A clear and helpful lesson.' }).success,
    true,
  );
});

test('rejects ratings outside the five-star range', () => {
  assert.equal(reviewPayloadSchema.safeParse({ rating: 0, comment: '' }).success, false);
  assert.equal(reviewPayloadSchema.safeParse({ rating: 6, comment: '' }).success, false);
});
