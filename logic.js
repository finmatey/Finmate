// Pure logic (no DOM) so it can be unit-tested. Money = integer VND.
export const DEFAULT_CATEGORIES = [
  { id: 'food', color: '#EE9B6E', name: 'Ăn uống', icon: '🍜', type: 'expense' },
  { id: 'transport', color: '#A98BE0', name: 'Đi lại', icon: '🛵', type: 'expense' },
  { id: 'study', color: '#E8C547', name: 'Học tập', icon: '📚', type: 'expense' },
  { id: 'shopping', color: '#5FBF9A', name: 'Mua sắm', icon: '🛍️', type: 'expense' },
  { id: 'fun', color: '#3E7F6E', name: 'Giải trí', icon: '🎮', type: 'expense' },
  { id: 'other-exp', color: '#A9B5AE', name: 'Khác', icon: '📦', type: 'expense' },
  { id: 'allowance', color: '#2F7D62', name: 'Tiền tiêu vặt / lương', icon: '💵', type: 'income' },
  { id: 'other-inc', color: '#7CCFAE', name: 'Thu nhập khác', icon: '➕', type: 'income' },
];

export const formatVND = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
export const monthKey = (dateStr) => dateStr.slice(0, 7);
export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function parseAmount(input) {
  let s = String(input).trim().toLowerCase().replace(/\s/g, '');
  if (!s) return NaN;
  let mult = 1;
  if (s.endsWith('tr')) { mult = 1_000_000; s = s.slice(0, -2); }
  else if (s.endsWith('k')) { mult = 1_000; s = s.slice(0, -1); }
  if (mult > 1) s = s.replace(',', '.');
  else s = s.replace(/[.,]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * mult);
}

export function summarize(transactions, month) {
  const r = { income: 0, expense: 0, balance: 0, byCategory: {} };
  for (const t of transactions) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'income') r.income += t.amount;
    else { r.expense += t.amount; r.byCategory[t.categoryId] = (r.byCategory[t.categoryId] || 0) + t.amount; }
  }
  r.balance = r.income - r.expense;
  return r;
}

export function budgetStatus(budgets, transactions, month) {
  const s = summarize(transactions, month);
  return budgets.map((b) => {
    const spent = b.categoryId ? s.byCategory[b.categoryId] || 0 : s.expense;
    const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
    return { ...b, spent, remaining: b.limit - spent, pct, over: spent > b.limit, warn: pct >= 80 && spent <= b.limit };
  });
}

export const goalSaved = (goal) => goal.contributions.reduce((a, c) => a + c.amount, 0);
export const goalPct = (goal) => goal.target > 0 ? Math.min(100, Math.floor((goalSaved(goal) / goal.target) * 100)) : 0;

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function toCSV(transactions, categories) {
  const name = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Ngày', 'Loại', 'Danh mục', 'Số tiền', 'Ghi chú']];
  for (const t of [...transactions].sort((a, b) => a.date.localeCompare(b.date)))
    rows.push([t.date, t.type === 'income' ? 'Thu' : 'Chi', name[t.categoryId] || t.categoryId, t.amount, t.note]);
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function emptyState() {
  return { version: 1, transactions: [], categories: DEFAULT_CATEGORIES, budgets: [], goals: [] };
}

export function validateImport(data) {
  if (!data || typeof data !== 'object') throw new Error('File không hợp lệ');
  const { transactions, categories, budgets, goals } = data;
  if (![transactions, categories, budgets, goals].every(Array.isArray)) throw new Error('Thiếu dữ liệu bắt buộc');
  for (const t of transactions)
    if (!Number.isInteger(t.amount) || t.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !['income', 'expense'].includes(t.type))
      throw new Error('Có giao dịch không hợp lệ');
  return { ...emptyState(), transactions, categories, budgets, goals };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const daysInMonth = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };

export function dailySpend(transactions, month) {
  const days = Array(daysInMonth(month)).fill(0);
  for (const t of transactions) if (t.type === 'expense' && monthKey(t.date) === month) days[Number(t.date.slice(8, 10)) - 1] += t.amount;
  return days;
}

export function dailyAllowance(limit, spent, month, today) {
  if (monthKey(today) !== month) return null;
  const daysLeft = daysInMonth(month) - Number(today.slice(8, 10)) + 1;
  const remaining = limit - spent;
  return { remaining, daysLeft, over: remaining < 0, perDay: remaining > 0 ? Math.floor(remaining / daysLeft) : 0 };
}

export function compactVND(n) {
  const r1 = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  if (n >= 1_000_000_000) return r1(n / 1_000_000_000) + 'T';
  if (n >= 1_000_000) { const v = r1(n / 1_000_000); return Number(v.replace(',', '.')) >= 1000 ? '1T' : v + 'tr'; }
  if (n >= 1_000) { const k = Math.round(n / 1_000); return k >= 1000 ? '1tr' : k + 'k'; }
  return String(n);
}

export function monthlyFlow(transactions, endMonth, count = 6) {
  return Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - (count - 1))).map((month) => {
    const s = summarize(transactions, month); return { month, income: s.income, expense: s.expense };
  });
}
export const normalizeText = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
export function matchTx(t, query, catName) {
  const q = normalizeText(query).trim(); if (!q) return true;
  return normalizeText(`${t.note || ''} ${catName || ''}`).includes(q);
}
export function niceMax(v) { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
