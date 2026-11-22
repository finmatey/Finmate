import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUsername, movementView, medal, mapLbError, esc, PERIODS, BADGES } from './leaderboard-logic.js';

test('username validation matches the database constraint', () => {
  for (const ok of ['abc', 'sao_mai_12', 'A1b2c3']) assert.ok(validateUsername(ok), ok);
  for (const bad of ['ab', 'has space', 'a@b.com', 'x'.repeat(21), '', null, 'tên_việt']) assert.ok(!validateUsername(bad), String(bad));
});
test('rank movement display', () => {
  assert.deepEqual(movementView(3), { cls: 'up', txt: '▲3' });
  assert.deepEqual(movementView(-2), { cls: 'down', txt: '▼2' });
  assert.deepEqual(movementView(0), { cls: 'same', txt: '–' });
  assert.deepEqual(movementView(null), { cls: 'new', txt: 'Mới' });
});
test('medals only for the top 3', () => {
  assert.equal(medal(1), '🥇'); assert.equal(medal(3), '🥉'); assert.equal(medal(4), '');
});
test('error mapping hides raw database errors', () => {
  assert.match(mapLbError({ message: 'username_taken' }), /đã có người/);
  assert.match(mapLbError({ message: 'set_school_first' }), /trường/i);
  assert.doesNotMatch(mapLbError({ message: 'relation "x" does not exist' }), /relation/);
});
test('usernames are HTML-escaped before rendering', () => {
  assert.equal(esc('<img onerror=1>'), '&lt;img onerror=1&gt;');
});
test('periods and badges are defined', () => {
  assert.deepEqual(PERIODS.map((p) => p[0]), ['daily', 'weekly', 'monthly', 'alltime']);
  assert.ok(Object.keys(BADGES).length >= 8);
});
