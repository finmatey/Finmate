// Pure vanilla JavaScript business logic for FinMate (no DOM, no dependencies).
// Works both as a browser <script> (even via file://) and in Node.js tests.
(function (root) {
  'use strict';

  const DEFAULT_CATEGORIES = [
    { id: 'food', color: '#EE9B6E', name: 'Ăn uống', icon: '🍜', type: 'expense' },
    { id: 'milktea', color: '#E07A5F', name: 'Trà sữa & Ăn vặt', icon: '🧋', type: 'expense' },
    { id: 'transport', color: '#A98BE0', name: 'Đi lại & Gửi xe', icon: '🛵', type: 'expense' },
    { id: 'study', color: '#E8C547', name: 'Học tập & Photo', icon: '📚', type: 'expense' },
    { id: 'shopping', color: '#5FBF9A', name: 'Mua sắm', icon: '🛍️', type: 'expense' },
    { id: 'fun', color: '#3E7F6E', name: 'Giải trí', icon: '🎮', type: 'expense' },
    { id: 'other-exp', color: '#A9B5AE', name: 'Khác', icon: '📦', type: 'expense' },
    { id: 'allowance', color: '#2F7D62', name: 'Tiền gia đình cho', icon: '💵', type: 'income' },
    { id: 'parttime', color: '#459B7B', name: 'Làm thêm / Gia sư', icon: '💼', type: 'income' },
    { id: 'other-inc', color: '#7CCFAE', name: 'Thu nhập khác', icon: '➕', type: 'income' },
  ];

  const DEFAULT_WALLETS = [
    { id: 'cash', name: 'Tiền mặt', shortName: 'Tiền mặt', initialBalance: 220_000, icon: '💵' },
    { id: 'bank', name: 'Thẻ ngân hàng', shortName: 'Ngân hàng', initialBalance: 850_000, icon: '🏦' },
    { id: 'momo', name: 'Ví MoMo', shortName: 'MoMo', initialBalance: 380_000, icon: '📱' },
    { id: 'zalopay', name: 'Ví ZaloPay', shortName: 'ZaloPay', initialBalance: 190_000, icon: '💠' },
  ];

  const MAC_DINH_CHI_VOUCHERS = [
    { id: 'v-milktea', merchant: 'Trà Sữa Mộc · Đối diện cổng MĐC', areaNote: 'Cách cổng 50m', title: 'Giảm 15.000 ₫ cho mọi ly size L', discountLabel: '-15k Trà sữa', costPoints: 80, accent: '#F8DCCB' },
    { id: 'v-photo', merchant: 'Tiệm Photo Cô Lan · Cổng sau MĐC', areaNote: 'Hẻm 12 Tân Hòa Đông', title: 'Miễn phí in & photo 20 trang tài liệu', discountLabel: 'Free 20 trang', costPoints: 60, accent: '#F7E7A8' },
    { id: 'v-parking', merchant: 'Bãi Gửi Xe Chú Ba · Cổng phụ', areaNote: 'Sát vách trường MĐC', title: 'Combo miễn phí gửi xe 5 lượt', discountLabel: '5 lượt gửi xe', costPoints: 50, accent: '#E8DDF8' },
    { id: 'v-banhmi', merchant: 'Bánh Mì & Sữa Đậu Nành Sáng', areaNote: 'Góc ngã tư trường MĐC', title: 'Giảm 10.000 ₫ hóa đơn từ 25.000 ₫', discountLabel: '-10k Ăn sáng', costPoints: 45, accent: '#E1F5EC' },
  ];

  const LEADERBOARD_PEERS = [
    { id: 'p1', name: 'Bảo Ngọc', className: '10A10', grade: 10, savedThisMonth: 740_000, savingsRatePct: 37, streakDays: 14 },
    { id: 'p2', name: 'Hoàng Nam', className: '12A1', grade: 12, savedThisMonth: 820_000, savingsRatePct: 41, streakDays: 19 },
    { id: 'p3', name: 'Gia Huy', className: '10A10', grade: 10, savedThisMonth: 510_000, savingsRatePct: 28, streakDays: 8 },
    { id: 'p4', name: 'Khánh Vy', className: '11A3', grade: 11, savedThisMonth: 690_000, savingsRatePct: 34, streakDays: 11 },
    { id: 'p5', name: 'Thảo Nhi', className: '10A2', grade: 10, savedThisMonth: 450_000, savingsRatePct: 24, streakDays: 5 },
    { id: 'p6', name: 'Tuấn Kiệt', className: '11A8', grade: 11, savedThisMonth: 390_000, savingsRatePct: 21, streakDays: 7 },
  ];

  const BANK_SYNC_FEED = [
    { type: 'expense', amount: 32_000, categoryId: 'food', walletId: 'bank', note: 'QR Pay Cơm tấm cổng sau MĐC (Casso)', source: 'bank-sync' },
    { type: 'expense', amount: 45_000, categoryId: 'milktea', walletId: 'bank', note: 'MoMo/TPBank - Trà sữa Matcha đá xay', source: 'bank-sync' },
    { type: 'income', amount: 200_000, categoryId: 'parttime', walletId: 'bank', note: 'CK Phụ huynh em An - Gia sư Toán', source: 'bank-sync' },
  ];

  const formatVND = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
  const monthKey = (d) => d.slice(0, 7);
  const todayStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  function parseAmount(input) {
    let s = String(input).trim().toLowerCase().replace(/\s/g, '');
    if (!s) return NaN;
    let mult = 1;
    if (s.endsWith('tr')) { mult = 1_000_000; s = s.slice(0, -2); }
    else if (s.endsWith('k')) { mult = 1_000; s = s.slice(0, -1); }
    s = mult > 1 ? s.replace(',', '.') : s.replace(/[.,]/g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * mult);
  }

  function compactVND(n) {
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    const r1 = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');
    if (abs >= 1_000_000_000) return sign + r1(abs / 1_000_000_000) + 'T';
    if (abs >= 1_000_000) { const v = r1(abs / 1_000_000); return sign + (Number(v.replace(',', '.')) >= 1000 ? '1T' : v + 'tr'); }
    if (abs >= 1_000) { const k = Math.round(abs / 1_000); return sign + (k >= 1000 ? '1tr' : k + 'k'); }
    return sign + String(Math.round(abs));
  }

  function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function daysInMonth(m) {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo, 0).getDate();
  }

  function summarize(transactions, month) {
    const r = { income: 0, expense: 0, balance: 0, byCategory: {} };
    for (const t of transactions) {
      if (monthKey(t.date) !== month) continue;
      if (t.type === 'income') r.income += t.amount;
      else { r.expense += t.amount; r.byCategory[t.categoryId] = (r.byCategory[t.categoryId] || 0) + t.amount; }
    }
    r.balance = r.income - r.expense;
    return r;
  }

  function computeWalletBalances(wallets, transactions) {
    const balances = {};
    for (const w of wallets) balances[w.id] = w.initialBalance;
    for (const t of transactions) {
      const wid = t.walletId || 'cash';
      balances[wid] = (balances[wid] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    }
    return balances;
  }

  function budgetStatus(budgets, transactions, month) {
    const s = summarize(transactions, month);
    return budgets.map((b) => {
      const spent = b.categoryId ? s.byCategory[b.categoryId] || 0 : s.expense;
      const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
      return { ...b, spent, remaining: b.limit - spent, pct, over: spent > b.limit, warn: pct >= 80 && spent <= b.limit };
    });
  }

  const goalSaved = (jar) => jar.contributions.reduce((a, c) => a + c.amount, 0);
  const goalPct = (jar) => (jar.target > 0 ? Math.min(100, Math.floor((goalSaved(jar) / jar.target) * 100)) : 0);

  function applyJarAutoAllocation(jars, incomeAmount, date) {
    if (incomeAmount <= 0) return { updatedJars: jars, totalAllocated: 0 };
    let totalAllocated = 0;
    const updatedJars = jars.map((jar) => {
      const rem = Math.max(0, jar.target - goalSaved(jar));
      if (!jar.autoAllocatePct || rem <= 0) return jar;
      const share = Math.min(rem, Math.round((incomeAmount * jar.autoAllocatePct) / 100));
      if (share <= 0) return jar;
      totalAllocated += share;
      return { ...jar, contributions: [...jar.contributions, { amount: share, date, note: `Tự trích ${jar.autoAllocatePct}% thu nhập` }] };
    });
    return { updatedJars, totalAllocated };
  }

  function dailySpend(transactions, month) {
    const days = Array(daysInMonth(month)).fill(0);
    for (const t of transactions) {
      if (t.type === 'expense' && monthKey(t.date) === month) {
        const idx = Number(t.date.slice(8, 10)) - 1;
        if (idx >= 0 && idx < days.length) days[idx] += t.amount;
      }
    }
    return days;
  }

  function dailyAllowance(limit, spent, month, today) {
    if (monthKey(today) !== month) return null;
    const daysLeft = Math.max(1, daysInMonth(month) - Number(today.slice(8, 10)) + 1);
    const remaining = limit - spent;
    return { remaining, daysLeft, over: remaining < 0, perDay: remaining > 0 ? Math.floor(remaining / daysLeft) : 0 };
  }

  function monthlyFlow(transactions, endMonth, count = 6) {
    return Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - (count - 1))).map((month) => {
      const s = summarize(transactions, month);
      return { month, income: s.income, expense: s.expense };
    });
  }

  const normalizeText = (s) =>
    String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

  function matchTx(t, query, catName) {
    const q = normalizeText(query).trim();
    if (!q) return true;
    return normalizeText(`${t.note || ''} ${catName || ''}`).includes(q);
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v)), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }

  function toCSV(transactions, categories, wallets = DEFAULT_WALLETS) {
    const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const walletName = Object.fromEntries(wallets.map((w) => [w.id, w.name]));
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Ngày', 'Loại', 'Danh mục', 'Ví', 'Số tiền (VND)', 'Ghi chú']];
    for (const t of [...transactions].sort((a, b) => a.date.localeCompare(b.date))) {
      rows.push([t.date, t.type === 'income' ? 'Thu' : 'Chi', catName[t.categoryId] || t.categoryId, walletName[t.walletId] || 'Tiền mặt', t.amount, t.note]);
    }
    return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n');
  }

  function generateForecast(transactions, budgets, month, today) {
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
    let summaryText = '';
    if (!s.expense) summaryText = 'Chưa có chi tiêu trong tháng để dự báo.';
    else if (runOutDay) summaryText = `Với tốc độ tiêu ${formatVND(dailyBurnRate)}/ngày, đến ngày ${runOutDay} bạn sẽ chạm trần ngân sách (${formatVND(budgetLimit)}). Hãy giảm giải trí và trà sữa!`;
    else if (projectedRemaining !== null) summaryText = `Nhịp độ tốt! Dự kiến cuối tháng bạn còn dư ${formatVND(projectedRemaining)} so với ngân sách.`;
    else summaryText = `Tốc độ chi trung bình ${formatVND(dailyBurnRate)}/ngày · dự kiến cả tháng ${formatVND(projectedMonthEndSpend)}.`;
    return { dailyBurnRate, projectedMonthEndSpend, runOutDay, summaryText };
  }

  function generateAIInsights(transactions, categories, budgets, month, today) {
    const s = summarize(transactions, month);
    if (!s.expense) return [{ tone: 'tip', title: 'Sẵn sàng phân tích', message: 'Ghi vài khoản chi để AI phát hiện xu hướng tiêu tiền của bạn.' }];
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
    const sorted = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
    const out = [];
    if (sorted.length) {
      const [topId, topAmt] = sorted[0];
      const pct = Math.round((topAmt / s.expense) * 100);
      const name = catMap[topId]?.name || topId;
      if ((topId === 'food' || topId === 'milktea') && pct > 40) {
        out.push({ tone: 'warn', title: `${name} chiếm ${pct}% tổng chi`, message: `Tháng này bạn chi quá nhiều cho ${name.toLowerCase()} (${pct}%). Hãy thử mang cơm hoặc giảm trà sữa để tiết kiệm ~120.000 ₫ nhé!` });
      } else {
        out.push({ tone: 'tip', title: `${name} chi nhiều nhất (${pct}%)`, message: `Bạn đã chi ${formatVND(topAmt)} cho ${name.toLowerCase()} trong tháng này.` });
      }
    }
    const milkAmt = s.byCategory['milktea'] || 0;
    if (milkAmt > 0) {
      const milkPct = Math.round((milkAmt / s.expense) * 100);
      if (milkPct >= 20) out.push({ tone: 'tip', title: `Trà sữa chiếm ${milkPct}% chi tiêu`, message: 'Đổi voucher FinPoints quanh trường Mạc Đĩnh Chi giúp bạn giảm đáng kể khoản này.' });
    }
    let wknd = 0;
    for (const t of transactions) {
      if (t.type !== 'expense' || monthKey(t.date) !== month) continue;
      const [Y, M, D] = t.date.split('-').map(Number);
      const dow = new Date(Y, M - 1, D).getDay();
      if (dow === 0 || dow === 6) wknd += t.amount;
    }
    const wkndPct = Math.round((wknd / s.expense) * 100);
    if (wkndPct >= 35) out.push({ tone: 'tip', title: `Chi mạnh cuối tuần (${wkndPct}%)`, message: `Bạn thường tiêu nhiều vào T7 & CN (${formatVND(wknd)}).` });
    const fc = generateForecast(transactions, budgets, month, today);
    if (fc.runOutDay) out.push({ tone: 'warn', title: `Cảnh báo dự báo ngày ${fc.runOutDay}`, message: fc.summaryText });
    return out;
  }

  function generateAutoBudgetPlan(monthlyIncome) {
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
    return {
      totalLimit,
      savingSuggestion,
      allocations: splits.map((item) => ({ ...item, limit: Math.round((totalLimit * item.pct) / 100 / 1000) * 1000 })),
    };
  }

  function answerAIChat(question, state, month, today) {
    const q = normalizeText(question);
    const s = summarize(state.transactions, month);
    const fc = generateForecast(state.transactions, state.budgets, month, today);
    const foodTotal = (s.byCategory['food'] || 0) + (s.byCategory['milktea'] || 0);
    const foodPct = s.expense > 0 ? Math.round((foodTotal / s.expense) * 100) : 0;

    if (q.includes('an uong') || q.includes('tra sua') || q.includes('bot')) {
      return `Tháng này bạn đã chi ${formatVND(foodTotal)} cho Ăn uống + Trà sữa (${foodPct}% tổng chi ${formatVND(s.expense)}). Mẹo: mang nước từ nhà, giảm 2 ly trà sữa/tuần và đổi voucher FinPoints quanh trường Mạc Đĩnh Chi sẽ giúp bạn dư thêm ~150.000 ₫/tháng!`;
    }
    if (q.includes('du bao') || q.includes('het tien') || q.includes('cuoi thang')) {
      return fc.summaryText;
    }
    if (q.includes('ke hoach') || q.includes('chia') || q.includes('ngan sach')) {
      const plan = generateAutoBudgetPlan(s.income || 1_800_000);
      return `Với thu nhập ${formatVND(s.income || 1_800_000)}, AI khuyên dành ${formatVND(plan.savingSuggestion)} (20%) vào Hũ tiết kiệm và đặt ngân sách chi ${formatVND(plan.totalLimit)}/tháng.`;
    }
    const insights = generateAIInsights(state.transactions, state.categories, state.budgets, month, today);
    return insights.map((i) => `• ${i.title}: ${i.message}`).join('\n');
  }

  function buildComparisonReport(transactions, categories, month) {
    const prevMonth = shiftMonth(month, -1);
    const curr = summarize(transactions, month);
    const prev = summarize(transactions, prevMonth);
    const rows = categories
      .filter((c) => c.type === 'expense')
      .map((c) => {
        const currentVal = curr.byCategory[c.id] || 0;
        const prevVal = prev.byCategory[c.id] || 0;
        const diff = currentVal - prevVal;
        const diffPct = prevVal > 0 ? Math.round((diff / prevVal) * 100) : currentVal > 0 ? 100 : 0;
        return { ...c, currentVal, prevVal, diff, diffPct };
      })
      .filter((r) => r.currentVal > 0 || r.prevVal > 0)
      .sort((a, b) => b.currentVal - a.currentVal);
    return { prevMonth, curr, prev, rows };
  }

  function rankLeaderboard(peers, me, scope) {
    const list = [...peers, { ...me, id: 'me', isCurrentUser: true }];
    return list
      .filter((s) => (scope === 'grade' ? s.grade === me.grade : scope === 'class' ? s.className.toUpperCase() === me.className.toUpperCase() : true))
      .sort((a, b) => b.savedThisMonth - a.savedThisMonth);
  }

  function computeDebtTotals(debts) {
    let receivable = 0, payable = 0;
    for (const d of debts) {
      if (d.settled) continue;
      if (d.direction === 'lend') receivable += d.amount;
      else payable += d.amount;
    }
    return { receivable, payable, net: receivable - payable };
  }

  function createSeedState(now = new Date()) {
    const today = todayStr(now);
    const cm = today.slice(0, 7);
    const m1 = shiftMonth(cm, -1), m2 = shiftMonth(cm, -2), m3 = shiftMonth(cm, -3), m4 = shiftMonth(cm, -4), m5 = shiftMonth(cm, -5);
    const day = Number(today.slice(8, 10));
    const d = (off) => `${cm}-${String(Math.max(1, day - off)).padStart(2, '0')}`;
    const wknd = (() => {
      for (let i = 0; i < Math.min(day, 14); i++) {
        const dt = new Date(now.getFullYear(), now.getMonth(), day - i);
        if (dt.getDay() === 0 || dt.getDay() === 6) return todayStr(dt);
      }
      return `${cm}-07`;
    })();

    return {
      profile: { name: 'Minh Anh', className: '10A10', grade: 10, school: 'THPT Mạc Đĩnh Chi' },
      darkMode: false,
      isPremium: false,
      wallets: DEFAULT_WALLETS,
      categories: DEFAULT_CATEGORIES,
      transactions: [
        { id: 'c1', type: 'income', amount: 1_400_000, categoryId: 'allowance', walletId: 'bank', date: `${cm}-01`, note: 'Tiền tiêu vặt tháng từ mẹ' },
        { id: 'c2', type: 'income', amount: 450_000, categoryId: 'parttime', walletId: 'momo', date: `${cm}-05`, note: 'Trợ giảng tiếng Anh cuối tuần' },
        { id: 'c3', type: 'expense', amount: 165_000, categoryId: 'food', walletId: 'cash', date: d(1), note: 'Ăn trưa căn tin & bánh mì sáng' },
        { id: 'c4', type: 'expense', amount: 135_000, categoryId: 'milktea', walletId: 'momo', date: wknd, note: 'Trà sữa & bánh tráng trộn nhóm 10A10' },
        { id: 'c5', type: 'expense', amount: 195_000, categoryId: 'food', walletId: 'zalopay', date: wknd, note: 'Đi ăn lẩu tokbokki cuối tuần' },
        { id: 'c6', type: 'expense', amount: 95_000, categoryId: 'study', walletId: 'cash', date: d(3), note: 'Photo đề cương & mua bút highlight' },
        { id: 'c7', type: 'expense', amount: 60_000, categoryId: 'transport', walletId: 'cash', date: d(2), note: 'Vé xe buýt & gửi xe cổng sau' },
        { id: 'c8', type: 'expense', amount: 120_000, categoryId: 'fun', walletId: 'bank', date: wknd, note: 'Vé xem phim CGV cuối tuần' },
        { id: 'c9', type: 'expense', amount: 110_000, categoryId: 'milktea', walletId: 'momo', date: d(4), note: 'Trà đào sau giờ học thêm' },
        { id: 'm1a', type: 'income', amount: 1_100_000, categoryId: 'allowance', walletId: 'bank', date: `${m1}-02`, note: 'Tiền tiêu vặt qua thẻ' },
        { id: 'm1b', type: 'income', amount: 500_000, categoryId: 'allowance', walletId: 'cash', date: `${m1}-02`, note: 'Tiền mặt tiêu vặt' },
        { id: 'm1c', type: 'income', amount: 400_000, categoryId: 'parttime', walletId: 'zalopay', date: `${m1}-10`, note: 'Thưởng học sinh giỏi ZaloPay' },
        { id: 'm1d', type: 'expense', amount: 420_000, categoryId: 'food', walletId: 'cash', date: `${m1}-11`, note: 'Ăn uống tháng trước' },
        { id: 'm1e', type: 'expense', amount: 190_000, categoryId: 'milktea', walletId: 'momo', date: `${m1}-15`, note: 'Trà sữa & ăn vặt' },
        { id: 'm1f', type: 'expense', amount: 240_000, categoryId: 'study', walletId: 'bank', date: `${m1}-18`, note: 'Sách tham khảo' },
        { id: 'm1g', type: 'expense', amount: 160_000, categoryId: 'fun', walletId: 'zalopay', date: `${m1}-22`, note: 'Đi chơi nhóm lớp' },
        { id: 'm2a', type: 'income', amount: 1_550_000, categoryId: 'allowance', walletId: 'bank', date: `${m2}-02`, note: 'Tiền đầu năm học' },
        { id: 'm2b', type: 'expense', amount: 520_000, categoryId: 'study', walletId: 'bank', date: `${m2}-08`, note: 'Sách vở mới' },
        { id: 'm3a', type: 'income', amount: 1_400_000, categoryId: 'allowance', walletId: 'bank', date: `${m3}-03`, note: 'Tiền sinh hoạt tháng' },
        { id: 'm3b', type: 'expense', amount: 740_000, categoryId: 'shopping', walletId: 'bank', date: `${m3}-12`, note: 'Mua balo mới' },
        { id: 'm4a', type: 'income', amount: 1_650_000, categoryId: 'parttime', walletId: 'bank', date: `${m4}-05`, note: 'Dạy kèm hè' },
        { id: 'm4b', type: 'expense', amount: 610_000, categoryId: 'fun', walletId: 'bank', date: `${m4}-16`, note: 'Trại hè' },
        { id: 'm5a', type: 'income', amount: 1_350_000, categoryId: 'allowance', walletId: 'cash', date: `${m5}-01`, note: 'Tiền tiêu vặt' },
        { id: 'm5b', type: 'expense', amount: 670_000, categoryId: 'food', walletId: 'cash', date: `${m5}-14`, note: 'Ăn uống' },
      ],
      budgets: [
        { id: 'b-all', categoryId: null, limit: 1_450_000 },
        { id: 'b-food', categoryId: 'food', limit: 450_000 },
        { id: 'b-milk', categoryId: 'milktea', limit: 250_000 },
      ],
      jars: [
        { id: 'j1', name: 'Mua tai nghe Sony', icon: '🎧', target: 1_200_000, deadline: `${shiftMonth(cm, 2)}-20`, autoAllocatePct: 15, contributions: [{ amount: 620_000, date: `${cm}-02` }] },
        { id: 'j2', name: 'Bộ sách luyện thi IELTS', icon: '📖', target: 500_000, deadline: `${shiftMonth(cm, 1)}-15`, autoAllocatePct: 10, contributions: [{ amount: 200_000, date: `${cm}-05` }] },
      ],
      debts: [
        { id: 'd1', direction: 'lend', personName: 'Gia Huy', className: '10A10', amount: 55_000, date: d(2), note: 'Ứng tiền trà sữa & cơm trưa', walletId: 'momo', settled: false },
        { id: 'd2', direction: 'borrow', personName: 'Bảo Ngọc', className: '10A10', amount: 35_000, date: d(4), note: 'Tiền photo đề cương', walletId: 'cash', settled: false },
      ],
      finPoints: 185,
      streakDays: 6,
      lastCheckInDate: d(1),
      weeklyBudgetBonusClaimedWeek: '',
      pointHistory: [
        { id: 'p1', title: 'Chuỗi ghi chép 6 ngày', points: 60, date: d(1) },
        { id: 'p2', title: 'Không vượt ngân sách tuần trước', points: 50, date: d(5) },
        { id: 'p3', title: 'Đổi voucher Bánh mì Sáng', points: -45, date: d(6) },
      ],
      redeemedVouchers: [
        { id: 'rv1', merchant: 'Bánh Mì & Sữa Đậu Nành Sáng', title: 'Giảm 10.000 ₫ hóa đơn từ 25.000 ₫', discountLabel: '-10k Ăn sáng', code: 'FM-MDC-8421', redeemedAt: d(6), used: false },
      ],
      bankSync: { bankName: 'TPBank Live', provider: 'Casso', accountMask: '•••• 4829', lastSyncedAt: `${today} 07:30` },
      chatHistory: [
        { id: 'ch0', role: 'assistant', text: 'Chào Minh Anh! Hỏi mình về chi tiêu ăn uống, dự báo ngày hết tiền hoặc chia ngân sách tự động nhé.' },
      ],
    };
  }

  const FinMateLogic = {
    DEFAULT_CATEGORIES,
    DEFAULT_WALLETS,
    MAC_DINH_CHI_VOUCHERS,
    LEADERBOARD_PEERS,
    BANK_SYNC_FEED,
    formatVND,
    monthKey,
    todayStr,
    uid,
    parseAmount,
    compactVND,
    shiftMonth,
    daysInMonth,
    summarize,
    computeWalletBalances,
    budgetStatus,
    goalSaved,
    goalPct,
    applyJarAutoAllocation,
    dailySpend,
    dailyAllowance,
    monthlyFlow,
    normalizeText,
    matchTx,
    niceMax,
    toCSV,
    generateForecast,
    generateAIInsights,
    generateAutoBudgetPlan,
    answerAIChat,
    buildComparisonReport,
    rankLeaderboard,
    computeDebtTotals,
    createSeedState,
  };

  root.FinMateLogic = FinMateLogic;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FinMateLogic;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
