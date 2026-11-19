import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from './logic.js';

const tx = [
  { id: 1, type: 'income', amount: 1_000_000, categoryId: 'allowance', date: '2026-11-01', note: '' },
  { id: 2, type: 'expense', amount: 50_000, categoryId: 'food', date: '2026-11-02', note: '' },
  { id: 3, type: 'expense', amount: 150_000, categoryId: 'food', date: '2026-11-03', note: '' },
  { id: 4, type: 'expense', amount: 99_000, categoryId: 'fun', date: '2026-10-30', note: '' },
];

test('parseAmount', () => {
  assert.equal(L.parseAmount('50.000'), 50000);
  assert.equal(L.parseAmount('50,000'), 50000);
  assert.equal(L.parseAmount('50k'), 50000);
  assert.equal(L.parseAmount('1,5tr'), 1500000);
  assert.ok(Number.isNaN(L.parseAmount('abc')));
  assert.ok(Number.isNaN(L.parseAmount('')));
});
test('summarize by month', () => {
  const s = L.summarize(tx, '2026-11');
  assert.deepEqual([s.income, s.expense, s.balance], [1_000_000, 200_000, 800_000]);
  assert.equal(s.byCategory.food, 200_000);
  assert.equal(L.summarize(tx, '2026-10').expense, 99_000);
});
test('budgetStatus', () => {
  const [a, b] = L.budgetStatus([{ categoryId: 'food', limit: 250_000 }, { categoryId: null, limit: 150_000 }], tx, '2026-11');
  assert.equal(a.pct, 80); assert.ok(a.warn && !a.over);
  assert.ok(b.over && b.remaining === -50_000);
});
test('goals', () => {
  const g = { target: 1_000_000, contributions: [{ amount: 300_000 }, { amount: 200_000 }] };
  assert.equal(L.goalSaved(g), 500_000); assert.equal(L.goalPct(g), 50);
  assert.equal(L.goalPct({ target: 100, contributions: [{ amount: 500 }] }), 100);
});
test('shiftMonth', () => {
  assert.equal(L.shiftMonth('2026-12', 1), '2027-01');
  assert.equal(L.shiftMonth('2026-01', -1), '2025-12');
});
test('csv + import validation', () => {
  assert.match(L.toCSV(tx, L.DEFAULT_CATEGORIES), /Ăn uống/);
  assert.throws(() => L.validateImport({}));
  assert.throws(() => L.validateImport({ transactions: [{ amount: -1 }], categories: [], budgets: [], goals: [] }));
  assert.ok(L.validateImport({ transactions: tx, categories: [], budgets: [], goals: [] }));
});

test('daily helpers', () => {
  assert.equal(L.daysInMonth('2026-02'), 28);
  const d = L.dailySpend(tx, '2026-11'); assert.equal(d[1], 50_000); assert.equal(d[2], 150_000); assert.equal(d.length, 30);
  assert.deepEqual(L.dailyAllowance(300_000, 100_000, '2026-11', '2026-11-21'), { remaining: 200_000, daysLeft: 10, over: false, perDay: 20_000 });
  assert.equal(L.dailyAllowance(100, 200, '2026-11', '2026-11-21').over, true);
  assert.equal(L.dailyAllowance(100, 0, '2026-10', '2026-11-21'), null);
});

test('compactVND', () => { assert.equal(L.compactVND(1_398_000), '1,4tr'); assert.equal(L.compactVND(450_000), '450k'); assert.equal(L.compactVND(3_000_000), '3tr'); });

test('monthlyFlow', () => {
  const f = L.monthlyFlow(tx, '2026-11', 6);
  assert.equal(f.length, 6); assert.equal(f[0].month, '2026-06'); assert.equal(f[5].income, 1_000_000); assert.equal(f[5].expense, 200_000); assert.equal(f[4].expense, 99_000);
});
test('search ignores diacritics', () => {
  assert.ok(L.matchTx({ note: 'Trà sữa' }, 'tra sua', 'Ăn uống')); assert.ok(L.matchTx({ note: '' }, 'an uong', 'Ăn uống'));
  assert.ok(L.matchTx({ note: 'x' }, '', 'y')); assert.ok(!L.matchTx({ note: 'Phở' }, 'xang', 'Ăn uống'));
});
test('niceMax', () => { assert.equal(L.niceMax(4_000_000), 5_000_000); assert.equal(L.niceMax(1_398_000), 2_000_000); assert.equal(L.niceMax(0), 1); });

test('compactVND billions and millions', () => {
  assert.equal(L.compactVND(11_000_600_000), '11T'); assert.equal(L.compactVND(1_100_000_000), '1,1T'); assert.equal(L.compactVND(2_500_000_000), '2,5T');
  assert.equal(L.compactVND(1_100_000), '1,1tr'); assert.equal(L.compactVND(999_960_000), '1T'); assert.equal(L.compactVND(999_600), '1tr');
  assert.equal(L.compactVND(450_000), '450k'); assert.equal(L.compactVND(500), '500');
});
