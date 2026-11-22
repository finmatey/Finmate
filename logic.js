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

export const MAC_DINH_CHI_VOUCHERS = [
  { id: 'v-milktea', merchant: 'Trà Sữa Mộc · Đối diện cổng MĐC', areaNote: 'Cách cổng 50m', title: 'Giảm 15.000 ₫ cho mọi ly size L', discountLabel: '-15k Trà sữa', costPoints: 80, accent: '#F8DCCB' },
  { id: 'v-photo', merchant: 'Tiệm Photo Cô Lan · Cổng sau MĐC', areaNote: 'Hẻm 12 Tân Hòa Đông', title: 'Miễn phí in & photo 20 trang tài liệu', discountLabel: 'Free 20 trang', costPoints: 60, accent: '#F7E7A8' },
  { id: 'v-parking', merchant: 'Bãi Gửi Xe Chú Ba · Cổng phụ', areaNote: 'Sát vách trường MĐC', title: 'Combo miễn phí gửi xe 5 lượt', discountLabel: '5 lượt gửi xe', costPoints: 50, accent: '#E8DDF8' },
  { id: 'v-banhmi', merchant: 'Bánh Mì & Sữa Đậu Nành Sáng', areaNote: 'Góc ngã tư trường MĐC', title: 'Giảm 10.000 ₫ hóa đơn từ 25.000 ₫', discountLabel: '-10k Ăn sáng', costPoints: 45, accent: '#E1F5EC' },
];

export const LEADERBOARD_PEERS = [
  { id: 'p1', name: 'Bảo Ngọc', className: '10A10', grade: 10, savedThisMonth: 740_000, savingsRatePct: 37, streakDays: 14 },
  { id: 'p2', name: 'Hoàng Nam', className: '12A1', grade: 12, savedThisMonth: 820_000, savingsRatePct: 41, streakDays: 19 },
  { id: 'p3', name: 'Gia Huy', className: '10A10', grade: 10, savedThisMonth: 510_000, savingsRatePct: 28, streakDays: 8 },
  { id: 'p4', name: 'Khánh Vy', className: '11A3', grade: 11, savedThisMonth: 690_000, savingsRatePct: 34, streakDays: 11 },
  { id: 'p5', name: 'Thảo Nhi', className: '10A2', grade: 10, savedThisMonth: 450_000, savingsRatePct: 24, streakDays: 5 },
  { id: 'p6', name: 'Tuấn Kiệt', className: '11A8', grade: 11, savedThisMonth: 390_000, savingsRatePct: 21, streakDays: 7 },
];

export const DEFAULT_PROFILE = { name: '', className: '10A10', grade: 10, school: 'THPT Mạc Đĩnh Chi' };

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
    finPoints: 0, streakDays: 0, lastCheckInDate: '', weeklyBudgetBonusClaimedWeek: '', pointHistory: [], redeemedVouchers: [],
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
  const { bankSync: _b, isPremium: _p, ...clean } = data; // legacy fields from removed features
  return {
    ...base, ...clean,
    categories, wallets,
    transactions: arr(data.transactions, []), budgets: arr(data.budgets, []), goals: arr(data.goals, []).map((g) => ({ ...g, contributions: arr(g.contributions, []) })),
    debts: arr(data.debts, []), pointHistory: arr(data.pointHistory, []), redeemedVouchers: arr(data.redeemedVouchers, []), chatHistory: arr(data.chatHistory, []),
    profile: { ...DEFAULT_PROFILE, ...(data.profile && typeof data.profile === 'object' ? data.profile : {}) },
    darkMode: Boolean(data.darkMode),
    finPoints: num(data.finPoints), streakDays: num(data.streakDays),
    lastCheckInDate: typeof data.lastCheckInDate === 'string' ? data.lastCheckInDate : '',
    weeklyBudgetBonusClaimedWeek: typeof data.weeklyBudgetBonusClaimedWeek === 'string' ? data.weeklyBudgetBonusClaimedWeek : '',
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
    if (milkPct >= 20) out.push({ tone: 'tip', title: `Trà sữa chiếm ${milkPct}% chi tiêu`, message: 'Đổi voucher FinPoints quanh trường Mạc Đĩnh Chi giúp bạn giảm đáng kể khoản này.' });
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
    return `Tháng này bạn đã chi ${formatVND(foodTotal)} cho Ăn uống + Trà sữa (${foodPct}% tổng chi ${formatVND(s.expense)}). Mẹo: mang nước từ nhà, giảm 2 ly trà sữa/tuần và đổi voucher FinPoints quanh trường Mạc Đĩnh Chi sẽ giúp bạn dư thêm ~150.000 ₫/tháng!`;
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

export function rankLeaderboard(peers, me, scope) {
  const cls = (x) => String(x.className || '').toUpperCase();
  return [...peers, { ...me, id: 'me', isCurrentUser: true }]
    .filter((s) => (scope === 'grade' ? s.grade === me.grade : scope === 'class' ? cls(s) === cls(me) : true))
    .sort((a, b) => b.savedThisMonth - a.savedThisMonth);
}

export function computeDebtTotals(debts) {
  let receivable = 0, payable = 0;
  for (const d of debts) { if (d.settled) continue; if (d.direction === 'lend') receivable += d.amount; else payable += d.amount; }
  return { receivable, payable, net: receivable - payable };
}

export function currentWeekKey(today) {
  const [y, m, d] = today.split('-').map(Number), dt = new Date(y, m - 1, d), start = new Date(y, 0, 1);
  const wk = Math.ceil(((dt - start) / 86400000 + start.getDay() + 1) / 7);
  return `${y}-W${String(wk).padStart(2, '0')}`;
}

export const CHECKIN_POINTS = 15;
// Daily check-in: the streak continues only if the last check-in was yesterday, otherwise it restarts at 1.
export function computeCheckIn(lastCheckInDate, streakDays, today) {
  if (lastCheckInDate === today) return null;
  const [y, m, d] = today.split('-').map(Number), yest = todayStr(new Date(y, m - 1, d - 1));
  return { streakDays: lastCheckInDate === yest ? streakDays + 1 : 1, points: CHECKIN_POINTS };
}

// Demo data (the first project's seed), available from Settings -> "Nạp dữ liệu mẫu".
export function createSeedState(now = new Date()) {
  const today = todayStr(now), cm = today.slice(0, 7), day = Number(today.slice(8, 10));
  const m = (n) => shiftMonth(cm, -n), d = (off) => `${cm}-${String(Math.max(1, day - off)).padStart(2, '0')}`;
  const wknd = (() => { for (let i = 0; i < Math.min(day, 14); i++) { const dt = new Date(now.getFullYear(), now.getMonth(), day - i); if (dt.getDay() === 0 || dt.getDay() === 6) return todayStr(dt); } return `${cm}-07`; })();
  const tx = (id, type, amount, categoryId, walletId, date, note) => ({ id, type, amount, categoryId, walletId, date, note });
  return normalizeState({
    wallets: [{ ...DEFAULT_WALLETS[0], initialBalance: 220_000 }, { ...DEFAULT_WALLETS[1], initialBalance: 850_000 }, { ...DEFAULT_WALLETS[2], initialBalance: 380_000 }, { ...DEFAULT_WALLETS[3], initialBalance: 190_000 }],
    transactions: [
      tx('c1', 'income', 1_400_000, 'allowance', 'bank', `${cm}-01`, 'Tiền tiêu vặt tháng từ mẹ'),
      tx('c2', 'income', 450_000, 'parttime', 'momo', `${cm}-05`, 'Trợ giảng tiếng Anh cuối tuần'),
      tx('c3', 'expense', 165_000, 'food', 'cash', d(1), 'Ăn trưa căn tin & bánh mì sáng'),
      tx('c4', 'expense', 135_000, 'milktea', 'momo', wknd, 'Trà sữa & bánh tráng trộn nhóm 10A10'),
      tx('c5', 'expense', 195_000, 'food', 'zalopay', wknd, 'Đi ăn lẩu tokbokki cuối tuần'),
      tx('c6', 'expense', 95_000, 'study', 'cash', d(3), 'Photo đề cương & mua bút highlight'),
      tx('c7', 'expense', 60_000, 'transport', 'cash', d(2), 'Vé xe buýt & gửi xe cổng sau'),
      tx('c8', 'expense', 120_000, 'fun', 'bank', wknd, 'Vé xem phim cuối tuần'),
      tx('c9', 'expense', 110_000, 'milktea', 'momo', d(4), 'Trà đào sau giờ học thêm'),
      tx('m1a', 'income', 1_100_000, 'allowance', 'bank', `${m(1)}-02`, 'Tiền tiêu vặt qua thẻ'),
      tx('m1b', 'income', 500_000, 'allowance', 'cash', `${m(1)}-02`, 'Tiền mặt tiêu vặt'),
      tx('m1c', 'income', 400_000, 'parttime', 'zalopay', `${m(1)}-10`, 'Thưởng học sinh giỏi'),
      tx('m1d', 'expense', 420_000, 'food', 'cash', `${m(1)}-11`, 'Ăn uống tháng trước'),
      tx('m1e', 'expense', 190_000, 'milktea', 'momo', `${m(1)}-15`, 'Trà sữa & ăn vặt'),
      tx('m1f', 'expense', 240_000, 'study', 'bank', `${m(1)}-18`, 'Sách tham khảo'),
      tx('m1g', 'expense', 160_000, 'fun', 'zalopay', `${m(1)}-22`, 'Đi chơi nhóm lớp'),
      tx('m2a', 'income', 1_550_000, 'allowance', 'bank', `${m(2)}-02`, 'Tiền đầu năm học'),
      tx('m2b', 'expense', 520_000, 'study', 'bank', `${m(2)}-08`, 'Sách vở mới'),
      tx('m3a', 'income', 1_400_000, 'allowance', 'bank', `${m(3)}-03`, 'Tiền sinh hoạt tháng'),
      tx('m3b', 'expense', 740_000, 'shopping', 'bank', `${m(3)}-12`, 'Mua balo mới'),
      tx('m4a', 'income', 1_650_000, 'parttime', 'bank', `${m(4)}-05`, 'Dạy kèm hè'),
      tx('m4b', 'expense', 610_000, 'fun', 'bank', `${m(4)}-16`, 'Trại hè'),
      tx('m5a', 'income', 1_350_000, 'allowance', 'cash', `${m(5)}-01`, 'Tiền tiêu vặt'),
      tx('m5b', 'expense', 670_000, 'food', 'cash', `${m(5)}-14`, 'Ăn uống'),
    ],
    budgets: [{ id: 'b-all', categoryId: null, limit: 1_450_000 }, { id: 'b-food', categoryId: 'food', limit: 450_000 }, { id: 'b-milk', categoryId: 'milktea', limit: 250_000 }],
    goals: [
      { id: 'j1', name: 'Mua tai nghe Sony', icon: '🎧', target: 1_200_000, deadline: `${shiftMonth(cm, 2)}-20`, autoAllocatePct: 15, contributions: [{ amount: 620_000, date: `${cm}-02` }] },
      { id: 'j2', name: 'Bộ sách luyện thi IELTS', icon: '📖', target: 500_000, deadline: `${shiftMonth(cm, 1)}-15`, autoAllocatePct: 10, contributions: [{ amount: 200_000, date: `${cm}-05` }] },
    ],
    debts: [
      { id: 'd1', direction: 'lend', personName: 'Gia Huy', className: '10A10', amount: 55_000, date: d(2), note: 'Ứng tiền trà sữa & cơm trưa', walletId: 'momo', settled: false },
      { id: 'd2', direction: 'borrow', personName: 'Bảo Ngọc', className: '10A10', amount: 35_000, date: d(4), note: 'Tiền photo đề cương', walletId: 'cash', settled: false },
    ],
    finPoints: 185, streakDays: 6, lastCheckInDate: d(1),
    pointHistory: [
      { id: 'p1', title: 'Chuỗi ghi chép 6 ngày', points: 60, date: d(1) },
      { id: 'p2', title: 'Không vượt ngân sách tuần trước', points: 50, date: d(5) },
      { id: 'p3', title: 'Đổi voucher Bánh mì Sáng', points: -45, date: d(6) },
    ],
    redeemedVouchers: [{ id: 'rv1', merchant: 'Bánh Mì & Sữa Đậu Nành Sáng', title: 'Giảm 10.000 ₫ hóa đơn từ 25.000 ₫', discountLabel: '-10k Ăn sáng', code: 'FM-MDC-8421', redeemedAt: d(6), used: false }],
  });
}

// Streak shown to the user: it only counts if the last check-in was today or yesterday.
export function activeStreak(lastCheckInDate, streakDays, today) {
  if (!lastCheckInDate) return 0;
  if (lastCheckInDate === today) return streakDays;
  const [y, m, d] = today.split('-').map(Number);
  return lastCheckInDate === todayStr(new Date(y, m - 1, d - 1)) ? streakDays : 0;
}
