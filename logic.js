// Pure logic (no DOM) so it can be unit-tested. Money = integer VND.
export const DEFAULT_CATEGORIES = [
  { id: 'food', color: '#EE9B6E', name: 'Ăn uống', icon: '🍜', type: 'expense' },
  { id: 'milktea', color: '#E07A5F', name: 'Trà sữa & Ăn vặt', icon: '🧋', type: 'expense' },
  { id: 'transport', color: '#A98BE0', name: 'Đi lại', icon: '🛵', type: 'expense' },
  { id: 'study', color: '#E8C547', name: 'Học tập', icon: '📚', type: 'expense' },
  { id: 'shopping', color: '#5FBF9A', name: 'Mua sắm', icon: '🛍️', type: 'expense' },
  { id: 'fun', color: '#3E7F6E', name: 'Giải trí', icon: '🎮', type: 'expense' },
  { id: 'other-exp', color: '#A9B5AE', name: 'Khác', icon: '📦', type: 'expense' },
  { id: 'allowance', color: '#2F7D62', name: 'Tiền tiêu vặt / lương', icon: '💵', type: 'income' },
  { id: 'parttime', color: '#459B7B', name: 'Làm thêm / Gia sư', icon: '💼', type: 'income' },
  { id: 'other-inc', color: '#7CCFAE', name: 'Thu nhập khác', icon: '➕', type: 'income' },
];

// ---- Features ported from the "FinMate HTML/CSS/JS" version ----
export const DEFAULT_WALLETS = [
  { id: 'cash', name: 'Tiền mặt', shortName: 'Tiền mặt', initialBalance: 0, icon: '💵' },
  { id: 'bank', name: 'Thẻ ngân hàng', shortName: 'Ngân hàng', initialBalance: 0, icon: '🏦' },
  { id: 'momo', name: 'Ví MoMo', shortName: 'MoMo', initialBalance: 0, icon: '📱' },
  { id: 'zalopay', name: 'Ví ZaloPay', shortName: 'ZaloPay', initialBalance: 0, icon: '💠' },
];

export const DEFAULT_PROFILE = { name: '', className: '', grade: 0, school: '' };

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
    if (t.transfer || monthKey(t.date) !== month) continue; // wallet transfers are not income/expense
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

export function toCSV(transactions, categories, wallets = DEFAULT_WALLETS) {
  const name = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const wname = Object.fromEntries(wallets.map((w) => [w.id, w.name]));
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Ngày', 'Loại', 'Danh mục', 'Ví', 'Số tiền', 'Ghi chú']];
  for (const t of [...transactions].sort((a, b) => a.date.localeCompare(b.date)))
    rows.push([t.date, t.transfer ? (t.type === 'income' ? 'Chuyển vào' : 'Chuyển ra') : t.type === 'income' ? 'Thu' : 'Chi', name[t.categoryId] || t.categoryId, wname[t.walletId || 'cash'] || 'Tiền mặt', t.amount, t.note]);
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function emptyState() {
  return {
    version: 2, transactions: [], categories: DEFAULT_CATEGORIES, budgets: [], goals: [],
    profile: { ...DEFAULT_PROFILE }, darkMode: false, wallets: DEFAULT_WALLETS.map((w) => ({ ...w })), debts: [],
    chatHistory: [],
  };
}

// Fills in anything an older save (or an import) is missing, without touching what is there.
export function normalizeState(data) {
  const base = emptyState(), arr = (v, d) => (Array.isArray(v) ? v : d);
  const categories = arr(data.categories, []).slice();
  for (const c of DEFAULT_CATEGORIES) if (!categories.some((x) => x.id === c.id)) categories.push(c);
  const wallets = arr(data.wallets, []).length ? data.wallets : base.wallets;
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  return {
    ...base, ...data,
    categories, wallets,
    transactions: arr(data.transactions, []), budgets: arr(data.budgets, []), goals: arr(data.goals, []).map((g) => ({ ...g, contributions: arr(g.contributions, []) })),
    debts: arr(data.debts, []), chatHistory: arr(data.chatHistory, []),
    profile: { ...DEFAULT_PROFILE, ...(data.profile && typeof data.profile === 'object' ? data.profile : {}) },
    darkMode: Boolean(data.darkMode),
  };
}

export function validateImport(data) {
  if (!data || typeof data !== 'object') throw new Error('File không hợp lệ');
  const { transactions, categories, budgets, goals } = data;
  if (![transactions, categories, budgets, goals].every(Array.isArray)) throw new Error('Thiếu dữ liệu bắt buộc');
  for (const t of transactions)
    if (!Number.isInteger(t.amount) || t.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !['income', 'expense'].includes(t.type))
      throw new Error('Có giao dịch không hợp lệ');
  return normalizeState(data);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const daysInMonth = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };

export function dailySpend(transactions, month) {
  const days = Array(daysInMonth(month)).fill(0);
  for (const t of transactions) if (!t.transfer && t.type === 'expense' && monthKey(t.date) === month) days[Number(t.date.slice(8, 10)) - 1] += t.amount;
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

/* ======================================================================
   Features ported from the "FinMate HTML/CSS/JS" version
   (wallets, jars auto-allocation, debts, AI assistant, FinPoints, ...)
   ====================================================================== */

export function computeWalletBalances(wallets, transactions) {
  const balances = {};
  for (const w of wallets) balances[w.id] = w.initialBalance || 0;
  for (const t of transactions) {
    const wid = t.walletId || 'cash';
    balances[wid] = (balances[wid] || 0) + (t.type === 'income' ? t.amount : -t.amount);
  }
  return balances;
}

// Warns when the current balance falls below `threshold` (default 20%) of the starting balance set in "Số dư đầu".
// No warning when no starting balance has been entered (nothing to compare against).
export function lowBalanceStatus(wallets, transactions, threshold = 0.2) {
  const bal = computeWalletBalances(wallets, transactions);
  const initial = wallets.reduce((a, w) => a + Math.max(0, w.initialBalance || 0), 0);
  const current = Object.values(bal).reduce((a, b) => a + b, 0);
  const lowWallets = wallets.filter((w) => (w.initialBalance || 0) > 0 && bal[w.id] < w.initialBalance * threshold)
    .map((w) => ({ id: w.id, name: w.shortName || w.name, balance: bal[w.id], initial: w.initialBalance }));
  return { initial, current, pct: initial > 0 ? Math.round((current / initial) * 100) : null, low: initial > 0 && current < initial * threshold, lowWallets };
}

// Splits a new income across saving goals ("jars") that have an auto-allocation percentage.
export function applyJarAutoAllocation(goals, incomeAmount, date) {
  if (!(incomeAmount > 0)) return { updatedJars: goals, totalAllocated: 0 };
  let totalAllocated = 0;
  const updatedJars = goals.map((g) => {
    const rem = Math.max(0, g.target - goalSaved(g));
    if (!g.autoAllocatePct || rem <= 0) return g;
    const share = Math.min(rem, Math.round((incomeAmount * g.autoAllocatePct) / 100));
    if (share <= 0) return g;
    totalAllocated += share;
    return { ...g, contributions: [...g.contributions, { amount: share, date, note: `Tự trích ${g.autoAllocatePct}% thu nhập` }] };
  });
  return { updatedJars, totalAllocated };
}

export function generateForecast(transactions, budgets, month, today) {
  const s = summarize(transactions, month);
  const overall = budgets.find((b) => b.categoryId === null);
  const totalDays = daysInMonth(month);
  const curDay = monthKey(today) === month ? Math.max(1, Number(today.slice(8, 10))) : totalDays;
  const dailyBurnRate = Math.round(s.expense / curDay);
  const projectedMonthEndSpend = Math.round(dailyBurnRate * totalDays);
  const budgetLimit = overall ? overall.limit : null;
  let runOutDay = null;
  if (budgetLimit && dailyBurnRate > 0) {
    const est = Math.ceil(budgetLimit / dailyBurnRate);
    if (est <= totalDays) runOutDay = est;
  }
  const projectedRemaining = budgetLimit !== null ? budgetLimit - projectedMonthEndSpend : null;
  let summaryText;
  if (!s.expense) summaryText = 'Chưa có chi tiêu trong tháng để dự báo.';
  else if (runOutDay) summaryText = `Với tốc độ tiêu ${formatVND(dailyBurnRate)}/ngày, đến ngày ${runOutDay} bạn sẽ chạm trần ngân sách (${formatVND(budgetLimit)}). Hãy giảm giải trí và trà sữa!`;
  else if (projectedRemaining !== null) summaryText = `Nhịp độ tốt! Dự kiến cuối tháng bạn còn dư ${formatVND(projectedRemaining)} so với ngân sách.`;
  else summaryText = `Tốc độ chi trung bình ${formatVND(dailyBurnRate)}/ngày · dự kiến cả tháng ${formatVND(projectedMonthEndSpend)}.`;
  return { dailyBurnRate, projectedMonthEndSpend, runOutDay, summaryText };
}

export function generateAIInsights(transactions, categories, budgets, month, today) {
  const s = summarize(transactions, month);
  if (!s.expense) return [{ tone: 'tip', title: 'Sẵn sàng phân tích', message: 'Ghi vài khoản chi để AI phát hiện xu hướng tiêu tiền của bạn.' }];
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const sorted = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  const out = [];
  if (sorted.length) {
    const [topId, topAmt] = sorted[0];
    const pct = Math.round((topAmt / s.expense) * 100);
    const name = catMap[topId]?.name || topId;
    if ((topId === 'food' || topId === 'milktea') && pct > 40)
      out.push({ tone: 'warn', title: `${name} chiếm ${pct}% tổng chi`, message: `Tháng này bạn chi quá nhiều cho ${name.toLowerCase()} (${pct}%). Hãy thử mang cơm hoặc giảm trà sữa để tiết kiệm ~120.000 ₫ nhé!` });
    else out.push({ tone: 'tip', title: `${name} chi nhiều nhất (${pct}%)`, message: `Bạn đã chi ${formatVND(topAmt)} cho ${name.toLowerCase()} trong tháng này.` });
  }
  const milkAmt = s.byCategory.milktea || 0;
  if (milkAmt > 0) {
    const milkPct = Math.round((milkAmt / s.expense) * 100);
    if (milkPct >= 20) out.push({ tone: 'tip', title: `Trà sữa chiếm ${milkPct}% chi tiêu`, message: 'Thử đặt ngân sách riêng cho trà sữa để kiểm soát khoản này.' });
  }
  let wknd = 0;
  for (const t of transactions) {
    if (t.transfer || t.type !== 'expense' || monthKey(t.date) !== month) continue;
    const [Y, M, D] = t.date.split('-').map(Number), dow = new Date(Y, M - 1, D).getDay();
    if (dow === 0 || dow === 6) wknd += t.amount;
  }
  const wkndPct = Math.round((wknd / s.expense) * 100);
  if (wkndPct >= 35) out.push({ tone: 'tip', title: `Chi mạnh cuối tuần (${wkndPct}%)`, message: `Bạn thường tiêu nhiều vào T7 & CN (${formatVND(wknd)}).` });
  const fc = generateForecast(transactions, budgets, month, today);
  if (fc.runOutDay) out.push({ tone: 'warn', title: `Cảnh báo dự báo ngày ${fc.runOutDay}`, message: fc.summaryText });
  return out;
}

export function generateAutoBudgetPlan(monthlyIncome) {
  const base = Math.max(100_000, Math.round(monthlyIncome));
  const savingSuggestion = Math.round(base * 0.2);
  const totalLimit = base - savingSuggestion;
  const splits = [
    { categoryId: 'food', name: 'Ăn uống', pct: 35 },
    { categoryId: 'study', name: 'Học tập & Photo', pct: 20 },
    { categoryId: 'transport', name: 'Đi lại & Gửi xe', pct: 15 },
    { categoryId: 'milktea', name: 'Trà sữa & Ăn vặt', pct: 15 },
    { categoryId: 'fun', name: 'Giải trí & Mua sắm', pct: 15 },
  ];
  return { totalLimit, savingSuggestion, allocations: splits.map((i) => ({ ...i, limit: Math.round((totalLimit * i.pct) / 100 / 1000) * 1000 })) };
}

export function answerAIChat(question, state, month, today) {
  const q = normalizeText(question);
  const s = summarize(state.transactions, month);
  const fc = generateForecast(state.transactions, state.budgets, month, today);
  const foodTotal = (s.byCategory.food || 0) + (s.byCategory.milktea || 0);
  const foodPct = s.expense > 0 ? Math.round((foodTotal / s.expense) * 100) : 0;
  if (q.includes('an uong') || q.includes('tra sua') || q.includes('bot'))
    return `Tháng này bạn đã chi ${formatVND(foodTotal)} cho Ăn uống + Trà sữa (${foodPct}% tổng chi ${formatVND(s.expense)}). Mẹo: mang nước từ nhà, giảm 2 ly trà sữa/tuần sẽ giúp bạn dư thêm một khoản đáng kể mỗi tháng!`;
  if (q.includes('du bao') || q.includes('het tien') || q.includes('cuoi thang')) return fc.summaryText;
  if (q.includes('ke hoach') || q.includes('chia') || q.includes('ngan sach')) {
    const plan = generateAutoBudgetPlan(s.income || 1_800_000);
    return `Với thu nhập ${formatVND(s.income || 1_800_000)}, AI khuyên dành ${formatVND(plan.savingSuggestion)} (20%) vào Hũ tiết kiệm và đặt ngân sách chi ${formatVND(plan.totalLimit)}/tháng.`;
  }
  return generateAIInsights(state.transactions, state.categories, state.budgets, month, today).map((i) => `• ${i.title}: ${i.message}`).join('\n');
}

export function buildComparisonReport(transactions, categories, month) {
  const prevMonth = shiftMonth(month, -1), curr = summarize(transactions, month), prev = summarize(transactions, prevMonth);
  const rows = categories.filter((c) => c.type === 'expense').map((c) => {
    const currentVal = curr.byCategory[c.id] || 0, prevVal = prev.byCategory[c.id] || 0, diff = currentVal - prevVal;
    const diffPct = prevVal > 0 ? Math.round((diff / prevVal) * 100) : currentVal > 0 ? 100 : 0;
    return { ...c, currentVal, prevVal, diff, diffPct };
  }).filter((r) => r.currentVal > 0 || r.prevVal > 0).sort((a, b) => b.currentVal - a.currentVal);
  return { prevMonth, curr, prev, rows };
}

export function computeDebtTotals(debts) {
  let receivable = 0, payable = 0;
  for (const d of debts) { if (d.settled) continue; if (d.direction === 'lend') receivable += d.amount; else payable += d.amount; }
  return { receivable, payable, net: receivable - payable };
}
