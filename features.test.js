import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from './logic.js';

test('wallet balances and transfers are excluded from income/expense', () => {
  const wallets = [{ id: 'cash', initialBalance: 100 }, { id: 'bank', initialBalance: 0 }];
  const tx = [
    { type: 'expense', amount: 30, categoryId: 'food', walletId: 'cash', date: '2026-11-02' },
    { type: 'expense', amount: 50, categoryId: 'other-exp', walletId: 'cash', date: '2026-11-03', transfer: true },
    { type: 'income', amount: 50, categoryId: 'other-inc', walletId: 'bank', date: '2026-11-03', transfer: true },
    { type: 'income', amount: 20, categoryId: 'allowance', date: '2026-11-04' }, // no walletId -> cash
  ];
  assert.deepEqual(L.computeWalletBalances(wallets, tx), { cash: 40, bank: 50 });
  const s = L.summarize(tx, '2026-11'); assert.deepEqual([s.income, s.expense], [20, 30]);
});

test('jar auto allocation', () => {
  const goals = [{ target: 1000, autoAllocatePct: 10, contributions: [] }, { target: 100, autoAllocatePct: 50, contributions: [{ amount: 90 }] }, { target: 500, contributions: [] }];
  const r = L.applyJarAutoAllocation(goals, 1000, '2026-11-05');
  assert.equal(r.totalAllocated, 110); assert.equal(L.goalSaved(r.updatedJars[0]), 100); assert.equal(L.goalSaved(r.updatedJars[1]), 100); assert.equal(r.updatedJars[2].contributions.length, 0);
  assert.equal(L.applyJarAutoAllocation(goals, 0, 'x').totalAllocated, 0);
});

test('check-in streak continues only from yesterday', () => {
  assert.deepEqual(L.computeCheckIn('2026-11-20', 6, '2026-11-21'), { streakDays: 7, points: 15 });
  assert.equal(L.computeCheckIn('2026-11-10', 6, '2026-11-21').streakDays, 1);
  assert.equal(L.computeCheckIn('2026-11-21', 6, '2026-11-21'), null);
  assert.equal(L.activeStreak('2026-11-10', 6, '2026-11-21'), 0); assert.equal(L.activeStreak('2026-11-21', 6, '2026-11-21'), 6);
});

test('debts, leaderboard, auto budget, forecast', () => {
  assert.deepEqual(L.computeDebtTotals([{ direction: 'lend', amount: 55 }, { direction: 'borrow', amount: 35 }, { direction: 'lend', amount: 9, settled: true }]), { receivable: 55, payable: 35, net: 20 });
  const b = L.rankLeaderboard(L.LEADERBOARD_PEERS, { name: 'Me', className: '', grade: 10, savedThisMonth: 600_000 }, 'grade');
  assert.ok(b.every((x) => x.grade === 10) && b.some((x) => x.isCurrentUser));
  const p = L.generateAutoBudgetPlan(2_000_000); assert.equal(p.savingSuggestion, 400_000); assert.equal(p.totalLimit, 1_600_000);
  const f = L.generateForecast([{ type: 'expense', amount: 300_000, categoryId: 'food', date: '2026-11-10' }], [{ categoryId: null, limit: 600_000 }], '2026-11', '2026-11-10');
  assert.equal(f.dailyBurnRate, 30_000); assert.equal(f.runOutDay, 20);
});

test('old saves are upgraded without losing data', () => {
  const old = { version: 1, transactions: [{ id: 'a', type: 'expense', amount: 5, date: '2026-11-01', categoryId: 'food' }], categories: [{ id: 'food', name: 'Ăn uống', icon: 'x', type: 'expense' }], budgets: [{ id: 'b', categoryId: null, limit: 9 }], goals: [{ id: 'g', name: 'G', target: 10, contributions: [] }] };
  const s = L.validateImport(old);
  assert.equal(s.transactions.length, 1); assert.equal(s.budgets[0].limit, 9); assert.equal(s.goals[0].name, 'G');
  assert.ok(s.categories.some((c) => c.id === 'milktea') && s.categories.find((c) => c.id === 'food').name === 'Ăn uống');
  assert.ok(s.wallets.length === 4 && Array.isArray(s.debts) && s.finPoints === 0);
});

test('csv has wallet column; demo seed is valid', () => {
  assert.match(L.toCSV([{ type: 'expense', amount: 1, categoryId: 'food', walletId: 'momo', date: '2026-11-01', note: '' }], L.DEFAULT_CATEGORIES, L.DEFAULT_WALLETS), /Ví MoMo/);
  assert.ok(L.validateImport(L.createSeedState()).transactions.length > 10);
});
