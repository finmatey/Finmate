import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNewAccount } from './auth.js';

test('cloud account validation', () => {
  assert.match(validateNewAccount('', 'a@b.com', 'abcdef'), /tên/i);
  assert.match(validateNewAccount('An', 'not-an-email', 'abcdef'), /email/i);
  assert.match(validateNewAccount('An', 'a@b.com', '123'), /ít nhất 6/);
  assert.match(validateNewAccount('An', 'a@b.com', 'abcdef', 'abcdeg'), /giống/);
  assert.equal(validateNewAccount('An', 'a@b.com', 'abcdef', 'abcdef'), '');
});
