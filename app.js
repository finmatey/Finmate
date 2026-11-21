const L = window.FinMateLogic;

const STORAGE_KEY = 'finmate:vanilla:v1';
let state = loadState();
let ui = {
  tab: 'home',
  planTab: 'budget',
  walletFilter: 'all',
  boardScope: 'grade',
  trendRange: 6,
  query: '',
  month: L.monthKey(L.todayStr()),
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.transactions)) return parsed;
    }
  } catch {}
  return L.createSeedState();
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cat = (id) => state.categories.find((c) => c.id === id) || { id, name: id, icon: '📦', color: '#A9B5AE', type: 'expense' };
const wallet = (id) => state.wallets.find((w) => w.id === id) || state.wallets[0];
const monthLabel = (m) => `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`;

function toast(msg, undoFn) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undoFn ? '<button type="button" id="undo-btn">Hoàn tác</button>' : ''}`;
  el.hidden = false;
  if (undoFn) {
    $('#undo-btn').onclick = () => { undoFn(); el.hidden = true; };
  }
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, undoFn ? 5000 : 2800);
}

function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function donutSVG(entries, total) {
  const R = 46, C = 2 * Math.PI * R, gap = entries.length > 1 ? 5 : 0;
  let off = 0;
  const segs = entries.map(([id, v]) => {
    const slice = total > 0 ? (v / total) * C : 0;
    const len = Math.max(slice - gap, 2);
    const cur = off;
    off += slice;
    return `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${cat(id).color}" stroke-width="15" stroke-linecap="round" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-cur}"/>`;
  }).join('');
  return `<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Cơ cấu chi tiêu"><g transform="rotate(-90 60 60)"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--mint)" stroke-width="15"/>${segs}</g><text x="60" y="57" text-anchor="middle" font-size="16" font-weight="800" fill="var(--ink)">${L.compactVND(total)}</text><text x="60" y="72" text-anchor="middle" font-size="9" font-weight="600" fill="var(--mute)">đã chi</text></svg>`;
}

function flowSVG(data) {
  const maxV = Math.max(...data.flatMap((d) => [d.income, d.expense]), 0);
  if (!maxV) return '<p class="mute">Chưa có dữ liệu dòng tiền.</p>';
  const W = 420, H = 180, pl = 40, pr = 12, pt = 14, pb = 26, top = L.niceMax(maxV), n = data.length;
  const X = (i) => (n <= 1 ? pl : pl + (i * (W - pl - pr)) / (n - 1));
  const Y = (v) => pt + (1 - v / top) * (H - pt - pb);
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const grid = [0, top / 2, top].map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="10" fill="var(--mute)">${v ? L.compactVND(v) : '0'}</text>`).join('');
  const labels = data.map((d, i) => `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--mute)">T${Number(d.month.slice(5))}</text>`).join('');
  const last = data[data.length - 1];
  return `<div style="display:flex;justify-content:space-between;margin:8px 0;font-size:.8rem;font-weight:800"><span>${monthLabel(last.month)}</span><span class="num"><span style="color:var(--ok)">Thu ${L.formatVND(last.income)}</span> · <span style="color:#C77446">Chi ${L.formatVND(last.expense)}</span></span></div>
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible">${grid}<path d="${path(data.map((d) => d.expense))}" fill="none" stroke="#EE9B6E" stroke-width="3" stroke-linecap="round"/><path d="${path(data.map((d) => d.income))}" fill="none" stroke="var(--ok)" stroke-width="3" stroke-linecap="round"/>${labels}</svg>`;
}

function screenHome() {
  const today = L.todayStr(), s = L.summarize(state.transactions, ui.month);
  const overall = state.budgets.find((b) => b.categoryId === null);
  const al = overall ? L.dailyAllowance(overall.limit, s.expense, ui.month, today) : null;
  const rem = overall ? overall.limit - s.expense : s.balance;
  const over = overall ? rem < 0 : false;
  const daily = L.dailySpend(state.transactions, ui.month), maxD = Math.max(...daily, 1);
  const todayDay = ui.month === L.monthKey(today) ? Number(today.slice(8, 10)) : 0;
  const bars = daily.map((v, i) => {
    const d = i + 1;
    const h = v ? Math.max(12, Math.round((v / maxD) * 100)) : 8;
    return `<i class="${d === todayDay ? 'today' : v ? '' : 'zero'}" style="height:${h}%" title="Ngày ${d}: ${L.formatVND(v)}"></i>`;
  }).join('');
  const insights = L.generateAIInsights(state.transactions, state.categories, state.budgets, ui.month, today);
  const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  const recent = state.transactions.filter((t) => L.monthKey(t.date) === ui.month).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const checkedIn = state.lastCheckInDate === today;

  return `
  <div class="grid-home-top">
    <section class="hero">
      <div>
        <div class="hero-top">
          <div>
            <span class="mute" style="font-weight:700">${overall ? (over ? 'Bạn đã vượt ngân sách' : 'Ngân sách còn lại') : 'Số dư tháng'}</span>
            <p class="hero-num num ${over ? 'over' : ''}">${over ? '−' : ''}${L.formatVND(Math.abs(rem))}</p>
            <p class="mute" style="margin:0;font-weight:600">${overall ? `Hạn mức ${L.formatVND(overall.limit)}${al && !over ? ` · Khoảng ${L.formatVND(al.perDay)}/ngày · còn ${al.daysLeft} ngày` : ''}` : 'Đặt ngân sách để tính hạn mức mỗi ngày.'}</p>
          </div>
          ${al ? `<div class="days-badge num"><span style="font-size:1.1rem">${al.daysLeft}</span><span style="font-size:10px">ngày</span></div>` : ''}
        </div>
        <div class="strip">${bars}</div>
        <div class="axis num"><span>Ngày 1</span><span>Ngày ${Math.ceil(daily.length / 2)}</span><span>Ngày ${daily.length}</span></div>
      </div>
      <div class="hero-actions">
        <button type="button" class="btn primary" data-act="add">+ Thêm chi tiêu</button>
        <button type="button" class="btn" data-act="addbudget">${overall ? 'Sửa ngân sách' : 'Đặt ngân sách'}</button>
      </div>
    </section>

    <div style="display:flex;flex-direction:column;gap:12px;justify-content:space-between">
      <div class="stats-pair">
        <div class="stat-box exp"><small>Đã chi</small><b class="num">${L.formatVND(s.expense)}</b></div>
        <div class="stat-box inc"><small>Đã thu</small><b class="num">${L.formatVND(s.income)}</b></div>
      </div>

      <div class="card" style="padding:16px;display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div>
          <p class="mute" style="margin:0">Chuỗi ghi chép · ${state.finPoints} FinPoints</p>
          <p style="margin:2px 0 0;font-weight:800">🔥 ${state.streakDays} ngày liên tục</p>
        </div>
        <button type="button" class="btn sm ${checkedIn ? 'tonal' : 'primary'}" data-act="${checkedIn ? 'gorewards' : 'checkin'}">${checkedIn ? 'Đổi quà' : 'Điểm danh +15đ'}</button>
      </div>

      <div class="card" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2 style="font-size:.92rem">Thêm nhanh</h2><span class="mute">1 chạm</span>
        </div>
        <div class="quick-grid">
          ${state.categories.filter((c) => c.type === 'expense').slice(0, 5).map((c) => `<button type="button" class="quick-btn" data-act="addcat" data-id="${c.id}"><span class="quick-ico" style="background:${c.color}28">${c.icon}</span><small>${esc(c.name.split(' ')[0])}</small></button>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <section class="card" style="margin-top:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div><h2 style="font-size:1rem">✨ Trợ lý AI Insights</h2><p class="mute" style="margin:2px 0 0">Phân tích tự động từ dữ liệu giao dịch của bạn</p></div>
      <button type="button" class="btn sm tonal" data-tab="assistant">Hỏi Trợ lý AI ›</button>
    </div>
    <div class="grid-3">
      ${insights.slice(0, 3).map((ins) => `<div class="insight-card ${ins.tone}"><b>${esc(ins.title)}</b><span>${esc(ins.message)}</span></div>`).join('')}
    </div>
  </section>

  <div class="grid-2">
    <section class="card">
      <h2 style="font-size:1rem">Tiền đã đi đâu</h2>
      ${cats.length ? `<div class="donut-wrap">${donutSVG(cats, s.expense)}<ul class="legend">${cats.map(([id, v]) => `<li><span><i class="dot" style="background:${cat(id).color}"></i>${cat(id).icon} ${esc(cat(id).name)}</span><b class="num">${L.formatVND(v)} · ${Math.round((v / s.expense) * 100)}%</b></li>`).join('')}</ul></div>` : '<p class="mute">Chưa có chi tiêu tháng này.</p>'}
    </section>
    <section class="card">
      <h2 style="font-size:1rem">Dòng tiền 6 tháng gần nhất</h2>
      ${flowSVG(L.monthlyFlow(state.transactions, ui.month, 6))}
    </section>
  </div>

  <div class="grid-2">
    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="font-size:1rem">Hũ tiết kiệm</h2>
        <button type="button" class="btn sm tonal" data-act="gojars">Quản lý hũ</button>
      </div>
      ${state.jars.map((j) => {
        const pct = L.goalPct(j);
        return `<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;font-size:.85rem;font-weight:700"><span>${j.icon} ${esc(j.name)}</span><span class="num">${pct}%</span></div><div class="meter"><i style="width:${pct}%"></i></div><div class="mute num" style="display:flex;justify-content:space-between"><span>${L.compactVND(L.goalSaved(j))} / ${L.compactVND(j.target)}</span><span>${j.autoAllocatePct ? `Tự trích ${j.autoAllocatePct}%` : 'Thủ công'}</span></div></div>`;
      }).join('')}
    </section>

    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="font-size:1rem">Giao dịch gần đây</h2>
        <button type="button" class="btn sm tonal" data-tab="tx">Xem tất cả</button>
      </div>
      <div class="list-box" style="border:0">
        ${recent.map((t) => `<div class="tx-item" style="padding:10px 2px"><span class="bubble" style="background:${cat(t.categoryId).color}28">${cat(t.categoryId).icon}</span><div class="grow"><div style="font-weight:700;font-size:.86rem">${esc(cat(t.categoryId).name)}</div><div class="mute ellipsis">${esc(t.note || 'Không ghi chú')} · ${esc(wallet(t.walletId).shortName)}</div></div><b class="num" style="color:${t.type === 'income' ? 'var(--ok)' : 'var(--ink)'}">${t.type === 'income' ? '+' : '−'}${L.formatVND(t.amount)}</b><button type="button" class="icon-x" data-act="deltx" data-id="${t.id}" aria-label="Xóa giao dịch ${esc(cat(t.categoryId).name)} ${L.formatVND(t.amount)}">✕</button></div>`).join('')}
      </div>
    </section>
  </div>`;
}

function screenTx() {
  const balances = L.computeWalletBalances(state.wallets, state.transactions);
  const total = Object.values(balances).reduce((a, b) => a + b, 0);
  const q = ui.query.trim();
  const list = state.transactions
    .filter((t) => (ui.walletFilter === 'all' || t.walletId === ui.walletFilter) && (q ? L.matchTx(t, q, cat(t.categoryId).name) : L.monthKey(t.date) === ui.month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return `
  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
    <div><h2 style="margin:0;font-size:1.05rem">Đa ví · Tổng tài sản <span class="num">${L.formatVND(total)}</span></h2><p class="mute" style="margin:2px 0 0">Bấm vào từng ví để lọc giao dịch</p></div>
    <div style="display:flex;gap:8px"><button type="button" class="btn sm" data-act="transfer">⇄ Chuyển ví</button><button type="button" class="btn sm" data-act="exportcsv">↓ Xuất CSV</button></div>
  </div>
  <div class="grid-wallets">
    <button type="button" class="wallet-card" aria-pressed="${ui.walletFilter === 'all'}" data-wallet="all"><small>Tất cả ví</small><b class="num">${L.formatVND(total)}</b></button>
    ${state.wallets.map((w) => `<button type="button" class="wallet-card" aria-pressed="${ui.walletFilter === w.id}" data-wallet="${w.id}"><small>${w.icon} ${esc(w.name)}</small><b class="num">${L.formatVND(balances[w.id] || 0)}</b></button>`).join('')}
  </div>

  <div style="display:flex;gap:10px;margin:16px 0">
    <input id="q" type="search" value="${esc(ui.query)}" placeholder="Tìm giao dịch (VD: tra sua, photo)..." aria-label="Tìm giao dịch" />
    <button type="button" class="btn primary" data-act="add">+ Ghi giao dịch</button>
  </div>

  <div class="list-box">
    ${list.length ? list.map((t) => `<div class="tx-item"><span class="bubble" style="background:${cat(t.categoryId).color}28">${cat(t.categoryId).icon}</span><div class="grow"><div style="font-weight:700">${esc(cat(t.categoryId).name)}</div><div class="mute ellipsis">${esc(t.note || 'Không ghi chú')} · ${esc(wallet(t.walletId).name)} · ${t.date.split('-').reverse().join('/')}</div></div><b class="num" style="color:${t.type === 'income' ? 'var(--ok)' : 'var(--ink)'}">${t.type === 'income' ? '+' : '−'}${L.formatVND(t.amount)}</b><button type="button" class="icon-x" data-act="deltx" data-id="${t.id}" aria-label="Xóa giao dịch ${esc(cat(t.categoryId).name)} ${L.formatVND(t.amount)}">✕</button></div>`).join('') : '<p class="mute" style="padding:28px;text-align:center">Không có giao dịch nào.</p>'}
  </div>`;
}

function screenPlan() {
  const seg = `<div class="seg" role="tablist"><button type="button" role="tab" aria-selected="${ui.planTab === 'budget'}" data-plantab="budget">Ngân sách</button><button type="button" role="tab" aria-selected="${ui.planTab === 'jars'}" data-plantab="jars">Hũ tiết kiệm</button><button type="button" role="tab" aria-selected="${ui.planTab === 'debts'}" data-plantab="debts">Sổ nợ bạn bè</button></div>`;

  if (ui.planTab === 'budget') {
    const st = L.budgetStatus(state.budgets, state.transactions, ui.month);
    const inc = L.summarize(state.transactions, ui.month).income || 1_800_000;
    const plan = L.generateAutoBudgetPlan(inc);
    return seg + `<div class="grid-2">
      <div style="display:grid;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:1rem">Hạn mức ${monthLabel(ui.month)}</h2><button type="button" class="btn sm primary" data-act="addbudget">+ Đặt ngân sách</button></div>
        ${st.map((b) => {
          const c = b.categoryId ? cat(b.categoryId) : { icon: '💰', name: 'Tổng chi tiêu tháng' };
          return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>${c.icon} ${esc(c.name)}</b><button type="button" class="icon-x" data-act="delbudget" data-id="${b.id}" aria-label="Xóa ngân sách ${esc(c.name)}">✕</button></div><div class="meter ${b.over ? 'over' : b.warn ? 'warn' : ''}"><i style="width:${Math.min(100, b.pct)}%"></i></div><div class="mute num" style="display:flex;justify-content:space-between"><span>Đã dùng ${L.formatVND(b.spent)} (${b.pct}%)</span><b style="color:${b.over ? 'var(--err)' : 'var(--ok)'}">${b.over ? 'Vượt ' + L.formatVND(-b.remaining) : 'Còn ' + L.formatVND(b.remaining)}</b></div></div>`;
        }).join('')}
      </div>
      <div class="card" style="background:var(--mint)">
        <h3 style="font-size:.95rem">✨ Chia ngân sách tự động (AI)</h3>
        <p class="mute" style="margin:4px 0 12px">Thu nhập cơ sở: <b class="num">${L.formatVND(inc)}</b> · Tiết kiệm 20% (<b class="num">${L.formatVND(plan.savingSuggestion)}</b>)</p>
        ${plan.allocations.map((a) => `<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:4px 0"><span>${a.name} (${a.pct}%)</span><b class="num">${L.formatVND(a.limit)}</b></div>`).join('')}
        <button type="button" class="btn primary block" data-act="applyautobudget" data-id="${inc}">Áp dụng kế hoạch AI</button>
      </div>
    </div>`;
  }

  if (ui.planTab === 'jars') {
    return seg + `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div><h2 style="font-size:1rem;margin:0">Hũ tiết kiệm</h2><p class="mute" style="margin:2px 0 0">Tự động trích % từ thu nhập mới</p></div><button type="button" class="btn sm primary" data-act="addjar">+ Tạo hũ</button></div>
    <div class="grid-2">${state.jars.map((j) => {
      const pct = L.goalPct(j);
      return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>${j.icon} ${esc(j.name)}</b><span class="num" style="font-weight:800;font-size:1.1rem;color:var(--primary)">${pct}%</span></div><div class="meter"><i style="width:${pct}%"></i></div><div class="mute num" style="display:flex;justify-content:space-between;margin-bottom:12px"><span>${L.formatVND(L.goalSaved(j))} / ${L.formatVND(j.target)}</span><span>Tự trích ${j.autoAllocatePct}%</span></div><div style="display:flex;gap:8px"><button type="button" class="btn sm tonal" data-act="jar100" data-id="${j.id}">+100k</button><button type="button" class="btn sm primary" data-act="jar250" data-id="${j.id}">+250k</button><button type="button" class="btn sm" data-act="deljar" data-id="${j.id}" aria-label="Xóa hũ ${esc(j.name)}">Xóa</button></div></div>`;
    }).join('')}</div>`;
  }

  const dt = L.computeDebtTotals(state.debts);
  return seg + `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="font-size:1rem;margin:0">Sổ nợ bạn bè</h2><button type="button" class="btn sm primary" data-act="adddebt">+ Ghi khoản nợ</button></div>
  <div class="grid-3" style="margin-bottom:14px"><div class="card" style="background:var(--mint)"><small class="mute">Cho vay</small><div class="num" style="font-weight:800;font-size:1.15rem">${L.formatVND(dt.receivable)}</div></div><div class="card" style="background:var(--peach)"><small class="mute">Đang vay</small><div class="num" style="font-weight:800;font-size:1.15rem">${L.formatVND(dt.payable)}</div></div><div class="card"><small class="mute">Ròng</small><div class="num" style="font-weight:800;font-size:1.15rem">${L.formatVND(dt.net)}</div></div></div>
  <div class="list-box">${state.debts.map((d) => `<div class="tx-item"><div class="grow"><b>${d.direction === 'lend' ? `Cho ${esc(d.personName)} vay` : `Mình vay ${esc(d.personName)}`}</b><div class="mute">${esc(d.note)} · Lớp ${esc(d.className || '')}</div></div><b class="num" style="color:${d.direction === 'lend' ? 'var(--ok)' : 'var(--err)'}">${L.formatVND(d.amount)}</b>${d.settled ? '<span class="mute">Đã tất toán</span>' : `<button type="button" class="btn sm tonal" data-act="settledebt" data-id="${d.id}">Tất toán</button>`}</div>`).join('')}</div>`;
}

function currentWeekKey(today) {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const start = new Date(y, 0, 1);
  const wk = Math.ceil(((dt - start) / 86400000 + start.getDay() + 1) / 7);
  return `${y}-W${String(wk).padStart(2, '0')}`;
}

function screenRewards() {
  const today = L.todayStr(), s = L.summarize(state.transactions, ui.month);
  const checkedIn = state.lastCheckInDate === today;
  const overall = state.budgets.find((b) => b.categoryId === null);
  const underBudget = !overall || s.expense <= overall.limit;
  const wkKey = currentWeekKey(today);
  const weekClaimed = state.weeklyBudgetBonusClaimedWeek === wkKey;
  const saved = Math.max(0, s.balance);
  const rate = s.income > 0 ? Math.round((saved / s.income) * 100) : 0;
  const board = L.rankLeaderboard(L.LEADERBOARD_PEERS, { ...state.profile, savedThisMonth: saved, savingsRatePct: rate, streakDays: state.streakDays }, ui.boardScope);

  return `
  <div class="grid-2" style="margin-top:0">
    <section class="reward-banner">
      <small style="opacity:.8">Điểm thưởng tích lũy</small>
      <div class="num" style="font-size:2.4rem;font-weight:800;color:#F7E7A8">${state.finPoints} <span style="font-size:1rem;color:#fff">FinPoints</span></div>
      <p style="margin:6px 0 0;font-size:.85rem">Chuỗi ${state.streakDays} ngày · Đổi voucher quanh ${esc(state.profile.school)}</p>
      <div class="streak-row">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<div class="streak-pill ${n <= state.streakDays ? 'on' : ''}">N${n}</div>`).join('')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button type="button" class="btn" style="background:#F7E7A8;color:#183C35;border:0" ${checkedIn ? 'disabled' : ''} data-act="checkin">${checkedIn ? 'Đã điểm danh hôm nay' : 'Điểm danh +15 FinPoints'}</button>
        <button type="button" class="btn" style="background:rgba(255,255,255,0.14);color:#fff;border:1px solid rgba(255,255,255,0.28)" ${weekClaimed || !underBudget ? 'disabled' : ''} data-act="claimweek">${weekClaimed ? 'Đã nhận thưởng tuần' : underBudget ? 'Thưởng giữ ngân sách +50đ' : 'Đang vượt ngân sách'}</button>
      </div>
    </section>

    <section class="card">
      <h2 style="font-size:1rem;margin-bottom:8px">Lịch sử FinPoints</h2>
      ${state.pointHistory.slice(0, 5).map((p) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:.82rem"><span>${esc(p.title)}</span><b class="num" style="color:${p.points >= 0 ? 'var(--ok)' : 'var(--err)'}">${p.points >= 0 ? '+' : ''}${p.points}đ</b></div>`).join('')}
    </section>
  </div>

  <h2 style="margin:22px 0 10px;font-size:1.05rem">Đối tác quanh trường Mạc Đĩnh Chi</h2>
  <div class="grid-2" style="margin-top:0">
    ${L.MAC_DINH_CHI_VOUCHERS.map((v) => `<div class="card" style="display:flex;flex-direction:column;justify-content:space-between;gap:12px"><div><p class="mute" style="margin:0">${esc(v.merchant)}</p><h3 style="margin:4px 0 0;font-size:.92rem">${esc(v.title)}</h3></div><div style="display:flex;justify-content:space-between;align-items:center"><b class="num">${v.costPoints} FinPoints</b><button type="button" class="btn sm primary" ${state.finPoints < v.costPoints ? 'disabled' : ''} data-act="redeem" data-id="${v.id}">Đổi lấy mã QR</button></div></div>`).join('')}
  </div>

  ${state.redeemedVouchers.length ? `<section class="card" style="margin-top:16px"><h3 style="font-size:.95rem;margin-bottom:8px">Voucher của tôi</h3>${state.redeemedVouchers.map((rv) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)"><div><b style="font-size:.85rem">${esc(rv.discountLabel)} · ${esc(rv.merchant)}</b><div class="mute mono">${esc(rv.code)}</div></div><button type="button" class="btn sm tonal" data-act="openqr" data-id="${rv.id}">Mở mã QR</button></div>`).join('')}</section>` : ''}

  <section class="card" style="margin-top:18px">
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
      <div><h2 style="font-size:1rem">🏆 Bảng xếp hạng Tiết Kiệm</h2><p class="mute" style="margin:2px 0 0;color:var(--ok);font-weight:700">Lớp ${esc(state.profile.className)} đang dẫn đầu khối ${state.profile.grade} về tiết kiệm</p></div>
      <div style="display:flex;gap:6px">${[['school', 'Toàn trường'], ['grade', `Khối ${state.profile.grade}`], ['class', `Lớp ${state.profile.className}`]].map(([sc, lbl]) => `<button type="button" class="btn sm ${ui.boardScope === sc ? 'primary' : ''}" data-scope="${sc}">${lbl}</button>`).join('')}</div>
    </div>
    ${board.map((b, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 8px;border-bottom:1px solid var(--line);${b.isCurrentUser ? 'background:var(--mint);border-radius:12px' : ''}"><span><b>#${i + 1} ${esc(b.name)}</b> ${b.isCurrentUser ? '(Bạn)' : ''} <span class="mute">· Lớp ${esc(b.className)}</span></span><b class="num">${L.formatVND(b.savedThisMonth)}</b></div>`).join('')}
  </section>`;
}

function screenAssistant() {
  const today = L.todayStr();
  const fc = L.generateForecast(state.transactions, state.budgets, ui.month, today);
  const cmp = L.buildComparisonReport(state.transactions, state.categories, ui.month);
  const trend = L.monthlyFlow(state.transactions, ui.month, ui.trendRange);

  return `
  <section class="card" style="background:var(--lavender);margin-bottom:16px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px">
    <div><h2 style="font-size:1rem">👑 ${state.isPremium ? 'FinMate Premium HSSV đang bật' : 'FinMate Premium · 179.000 ₫/tháng (Ưu đãi HSSV 49k)'}</h2><p class="mute" style="margin:4px 0 0">Đồng bộ ngân hàng Casso/SePay, Chatbot tư vấn sâu, Báo cáo 12 tháng & Không quảng cáo.</p></div>
    <button type="button" class="btn sm primary" data-act="togglepremium">${state.isPremium ? 'Đang dùng Premium' : 'Trải nghiệm Premium'}</button>
  </section>

  ${!state.isPremium ? '<div class="card" style="background:var(--gold);padding:12px 16px;margin-bottom:16px;font-size:.8rem;font-weight:600">Quảng cáo bản Free: Giảm 20% dụng cụ học tập cho học sinh Mạc Đĩnh Chi.</div>' : ''}

  <div class="grid-2" style="margin-top:0">
    <section class="card">
      <h2 style="font-size:1rem">✨ Chatbot Tư vấn Tài chính</h2>
      <div class="chat-log" id="chat-log">
        ${state.chatHistory.map((m) => `<div class="bubble-msg ${m.role === 'user' ? 'user' : 'bot'}">${esc(m.text)}</div>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        <button type="button" class="btn sm" data-prompt="Tháng này mình tiêu nhiều vào ăn uống quá, làm sao để bớt?">Bớt tiền ăn uống?</button>
        <button type="button" class="btn sm" data-prompt="Dự báo cuối tháng mình có hết tiền không?">Dự báo cuối tháng</button>
        <button type="button" class="btn sm" data-prompt="Gợi ý chia ngân sách tự động">Chia ngân sách AI</button>
      </div>
      <form id="chatform" style="display:flex;gap:8px">
        <input id="chat-input" type="text" placeholder="Hỏi trợ lý AI..." aria-label="Nhập câu hỏi" />
        <button type="submit" class="btn primary">Gửi</button>
      </form>
    </section>

    <div style="display:grid;gap:16px">
      <section class="card">
        <h2 style="font-size:1rem">📈 Dự báo dòng tiền</h2>
        <div class="stats-pair" style="margin:12px 0">
          <div style="background:var(--bg);padding:12px;border-radius:14px"><small class="mute">Tiêu/ngày</small><b class="num" style="display:block;margin-top:4px">${L.formatVND(fc.dailyBurnRate)}</b></div>
          <div style="background:var(--bg);padding:12px;border-radius:14px"><small class="mute">Dự kiến tháng</small><b class="num" style="display:block;margin-top:4px">${L.formatVND(fc.projectedMonthEndSpend)}</b></div>
        </div>
        <p style="margin:0;font-size:.82rem;background:var(--mint);padding:12px;border-radius:14px">${esc(fc.summaryText)}</p>
      </section>

      <section class="card">
        <h2 style="font-size:1rem">🏦 Tích hợp Ngân hàng (${esc(state.bankSync.provider)})</h2>
        <p class="mute" style="margin:6px 0 12px">${esc(state.bankSync.bankName)} (${esc(state.bankSync.accountMask)}) · Đồng bộ lúc ${esc(state.bankSync.lastSyncedAt)}</p>
        <button type="button" class="btn primary block" style="margin-top:0" data-act="banksync">↻ Đồng bộ giao dịch ngân hàng ngay</button>
      </section>
    </div>
  </div>

  <section class="card" style="margin-top:16px">
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
      <div><h2 style="font-size:1rem">Báo cáo chi tiết & So sánh tháng trước</h2><p class="mute" style="margin:2px 0 0">${monthLabel(ui.month)} vs ${monthLabel(cmp.prevMonth)}</p></div>
      <div style="display:flex;gap:6px"><button type="button" class="btn sm ${ui.trendRange === 6 ? 'primary' : ''}" data-range="6">6 tháng</button><button type="button" class="btn sm ${ui.trendRange === 12 ? 'primary' : ''}" data-range="12">12 tháng</button><button type="button" class="btn sm" data-act="exportcsv">↓ Xuất CSV</button></div>
    </div>
    <div class="grid-2" style="margin-top:0">
      <div>${flowSVG(trend)}</div>
      <div style="overflow-x:auto">
        <table><thead><tr><th>Danh mục</th><th class="tr">Tháng trước</th><th class="tr">Tháng này</th><th class="tr">Chênh lệch</th></tr></thead>
        <tbody>${cmp.rows.map((r) => `<tr><td>${r.icon} ${esc(r.name)}</td><td class="tr num">${L.formatVND(r.prevVal)}</td><td class="tr num"><b>${L.formatVND(r.currentVal)}</b></td><td class="tr num" style="color:${r.diff > 0 ? 'var(--err)' : 'var(--ok)'}">${r.diff > 0 ? '+' : ''}${r.diffPct}%</td></tr>`).join('')}</tbody></table>
      </div>
    </div>
  </section>`;
}

function screenSettings() {
  return `
  <div class="grid-2" style="margin-top:0">
    <div style="display:grid;gap:16px">
      <section class="card">
        <h2 style="font-size:1rem">🌙 Giao diện</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
          <span class="mute">Chế độ Tối (Dark Mode)</span>
          <button type="button" class="btn sm primary" data-act="toggledark">${state.darkMode ? 'Bật Chế độ Sáng' : 'Bật Chế độ Tối'}</button>
        </div>
      </section>

      <section class="card">
        <h2 style="font-size:1rem">📊 Xuất báo cáo Excel/CSV & Sao lưu</h2>
        <p class="mute" style="margin:6px 0 12px">Tải file <b>BaoCao_FinMate.csv</b> mở bằng Excel hoặc sao lưu/khôi phục JSON.</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button type="button" class="btn primary" data-act="exportcsv">↓ Tải báo cáo chi tiêu</button>
          <button type="button" class="btn" data-act="exportjson">Sao lưu JSON</button>
          <button type="button" class="btn" data-act="importjson">Khôi phục JSON</button>
          <a class="btn tonal" href="/FinMate-HTML-CSS-JS.zip" download="FinMate-HTML-CSS-JS.zip">↓ Tải HTML/CSS/JS (.zip)</a>
          <button type="button" class="btn danger" data-act="reset">Khôi phục mẫu</button>
          <input id="json-import" type="file" accept="application/json" hidden />
        </div>
      </section>
    </div>

    <form class="card" id="profileform">
      <h2 style="font-size:1rem">🎓 Hồ sơ học sinh</h2>
      <label for="pname">Tên hiển thị</label><input id="pname" value="${esc(state.profile.name)}" />
      <label for="pclass">Lớp</label><input id="pclass" value="${esc(state.profile.className)}" />
      <label for="pgrade">Khối</label><select id="pgrade"><option value="10" ${state.profile.grade === 10 ? 'selected' : ''}>Khối 10</option><option value="11" ${state.profile.grade === 11 ? 'selected' : ''}>Khối 11</option><option value="12" ${state.profile.grade === 12 ? 'selected' : ''}>Khối 12</option></select>
      <button type="submit" class="btn primary block">Lưu hồ sơ</button>
    </form>
  </div>`;
}

const TITLES = {
  home: ['Hôm nay', screenHome, true],
  tx: ['Giao dịch & Ví', screenTx, true],
  plan: ['Kế hoạch', screenPlan, true],
  rewards: ['FinPoints & Xếp hạng', screenRewards, false],
  assistant: ['Trợ lý AI & Premium', screenAssistant, true],
  settings: ['Cài đặt', screenSettings, false],
};

function render() {
  document.documentElement.classList.toggle('dark', Boolean(state.darkMode));
  const [title, fn, showMonth] = TITLES[ui.tab];
  $('#bar').innerHTML = `<div><h1>${title}</h1><p class="bar-sub">${esc(state.profile.name)} · Lớp ${esc(state.profile.className)} · ${esc(state.profile.school)}</p></div>
  <div class="bar-right">${showMonth ? `<div class="pill"><button type="button" data-act="mprev" aria-label="Tháng trước">‹</button><b class="num">${monthLabel(ui.month)}</b><button type="button" data-act="mnext" aria-label="Tháng sau">›</button></div>` : ''}<button type="button" class="btn sm primary" data-act="add">+ Thêm</button></div>`;
  $('#view').innerHTML = fn();
  $('#sidebar-user').innerHTML = `<p class="sidebar-user-name">${esc(state.profile.name)}</p><p class="sidebar-user-sub">Lớp ${esc(state.profile.className)} · ${state.finPoints} FinPoints</p>`;
  $('#theme-state').textContent = state.darkMode ? 'Bật' : 'Tắt';
  document.querySelectorAll('[data-tab]').forEach((b) => {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const chatLog = $('#chat-log');
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
}

const dlg = $('#dlg');
function openAddTx(presetCat = 'food') {
  let type = 'expense', catId = presetCat, walletId = 'cash';
  dlg.innerHTML = `<form id="txform"><h2 style="margin:0 0 12px">Thêm giao dịch</h2>
    <div class="seg"><button type="button" aria-selected="true" data-type="expense">Chi tiêu</button><button type="button" aria-selected="false" data-type="income">Thu nhập</button></div>
    <label for="amt">Số tiền (VD: 50k, 1,5tr)</label><input id="amt" name="amt" placeholder="50k" required />
    <label for="wal">Ví nguồn tiền</label><select id="wal" name="wal">${state.wallets.map((w) => `<option value="${w.id}">${w.icon} ${esc(w.name)}</option>`).join('')}</select>
    <label for="cat">Danh mục</label><select id="cat" name="cat"></select>
    <label for="note">Ghi chú</label><input id="note" name="note" placeholder="VD: Trà sữa cổng trường" />
    <div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn" id="cancel-dlg" style="flex:1">Hủy</button><button type="submit" class="btn primary" style="flex:2">Lưu giao dịch</button></div>
  </form>`;
  const syncCats = () => {
    const opts = state.categories.filter((c) => c.type === type);
    if (!opts.some((c) => c.id === catId)) catId = opts[0].id;
    dlg.querySelector('#cat').innerHTML = opts.map((c) => `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('');
    dlg.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.type === type)));
  };
  dlg.querySelector('#txform').onclick = (e) => {
    const bt = e.target.closest('[data-type]');
    if (bt) { type = bt.dataset.type; syncCats(); }
  };
  dlg.querySelector('#cancel-dlg').onclick = () => dlg.close();
  dlg.querySelector('#txform').onsubmit = (e) => {
    e.preventDefault();
    const amount = L.parseAmount(dlg.querySelector('#amt').value);
    if (!(amount > 0)) { toast('Nhập số tiền hợp lệ.'); return; }
    walletId = dlg.querySelector('#wal').value;
    catId = dlg.querySelector('#cat').value;
    const note = dlg.querySelector('#note').value.trim();
    const today = L.todayStr();
    const newTx = { id: L.uid(), type, amount, categoryId: catId, walletId, date: today, note };
    state.transactions.push(newTx);
    if (type === 'income') {
      const alloc = L.applyJarAutoAllocation(state.jars, amount, today);
      state.jars = alloc.updatedJars;
    }
    ui.month = L.monthKey(today);
    save(); dlg.close(); render(); toast('Đã lưu giao dịch');
  };
  syncCats();
  dlg.showModal();
}

function openBudgetModal() {
  const overall = state.budgets.find((b) => b.categoryId === null);
  dlg.innerHTML = `<form id="budgetform"><h2 style="margin:0 0 12px">Đặt ngân sách tháng</h2>
    <label for="bcat">Áp dụng cho</label>
    <select id="bcat"><option value="">💰 Tổng chi tiêu tháng</option>${state.categories.filter((c) => c.type === 'expense').map((c) => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join('')}</select>
    <label for="blim">Hạn mức (VD: 1,5tr hoặc 450k)</label><input id="blim" value="${overall ? overall.limit : 1500000}" required />
    <div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn" id="cancel-dlg" style="flex:1">Hủy</button><button type="submit" class="btn primary" style="flex:2">Lưu ngân sách</button></div>
  </form>`;
  dlg.querySelector('#cancel-dlg').onclick = () => dlg.close();
  dlg.querySelector('#budgetform').onsubmit = (e) => {
    e.preventDefault();
    const lim = L.parseAmount(dlg.querySelector('#blim').value);
    if (!(lim > 0)) { toast('Nhập hạn mức hợp lệ.'); return; }
    const catId = dlg.querySelector('#bcat').value || null;
    const existing = state.budgets.find((x) => x.categoryId === catId);
    if (existing) existing.limit = lim;
    else state.budgets.push({ id: L.uid(), categoryId: catId, limit: lim });
    save(); dlg.close(); render(); toast('Đã cập nhật ngân sách');
  };
  dlg.showModal();
}

function openJarModal() {
  dlg.innerHTML = `<form id="jarform"><h2 style="margin:0 0 12px">Tạo hũ tiết kiệm mới</h2>
    <label for="jname">Tên mục tiêu</label><input id="jname" placeholder="VD: Mua sách ôn thi" required />
    <label for="jtarget">Số tiền mục tiêu (VD: 500k, 1,2tr)</label><input id="jtarget" placeholder="500k" required />
    <label for="jpct">Tự động trích % từ thu nhập mới</label><input id="jpct" type="number" min="0" max="50" value="10" />
    <div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn" id="cancel-dlg" style="flex:1">Hủy</button><button type="submit" class="btn primary" style="flex:2">Tạo hũ</button></div>
  </form>`;
  dlg.querySelector('#cancel-dlg').onclick = () => dlg.close();
  dlg.querySelector('#jarform').onsubmit = (e) => {
    e.preventDefault();
    const name = dlg.querySelector('#jname').value.trim();
    const target = L.parseAmount(dlg.querySelector('#jtarget').value);
    const pct = Math.max(0, Math.min(50, Number(dlg.querySelector('#jpct').value) || 0));
    if (!name || !(target > 0)) { toast('Nhập tên và mục tiêu hợp lệ.'); return; }
    state.jars.unshift({ id: L.uid(), name, icon: '🎯', target, autoAllocatePct: pct, contributions: [] });
    save(); dlg.close(); render(); toast('Đã tạo hũ tiết kiệm');
  };
  dlg.showModal();
}

function openDebtModal() {
  dlg.innerHTML = `<form id="debtform"><h2 style="margin:0 0 12px">Ghi sổ nợ bạn bè</h2>
    <label for="ddir">Loại khoản</label><select id="ddir"><option value="lend">Mình cho bạn vay</option><option value="borrow">Mình vay của bạn</option></select>
    <label for="dperson">Tên bạn bè</label><input id="dperson" placeholder="VD: Khánh Vy" required />
    <label for="damt">Số tiền (VD: 50k)</label><input id="damt" placeholder="50k" required />
    <label for="dwal">Ví giao dịch</label><select id="dwal">${state.wallets.map((w) => `<option value="${w.id}">${w.icon} ${esc(w.name)}</option>`).join('')}</select>
    <label for="dnote">Ghi chú</label><input id="dnote" placeholder="VD: Ứng tiền trà sữa" />
    <div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn" id="cancel-dlg" style="flex:1">Hủy</button><button type="submit" class="btn primary" style="flex:2">Lưu sổ nợ</button></div>
  </form>`;
  dlg.querySelector('#cancel-dlg').onclick = () => dlg.close();
  dlg.querySelector('#debtform').onsubmit = (e) => {
    e.preventDefault();
    const personName = dlg.querySelector('#dperson').value.trim();
    const amount = L.parseAmount(dlg.querySelector('#damt').value);
    if (!personName || !(amount > 0)) { toast('Nhập tên và số tiền hợp lệ.'); return; }
    state.debts.unshift({
      id: L.uid(),
      direction: dlg.querySelector('#ddir').value,
      personName,
      className: state.profile.className,
      amount,
      date: L.todayStr(),
      note: dlg.querySelector('#dnote').value.trim() || 'Ứng tiền',
      walletId: dlg.querySelector('#dwal').value,
      settled: false,
    });
    save(); dlg.close(); render(); toast('Đã ghi vào sổ nợ');
  };
  dlg.showModal();
}

function openTransferModal() {
  dlg.innerHTML = `<form id="xferform"><h2 style="margin:0 0 12px">Chuyển tiền giữa các ví</h2>
    <label for="xfrom">Từ ví</label><select id="xfrom">${state.wallets.map((w) => `<option value="${w.id}" ${w.id === 'bank' ? 'selected' : ''}>${w.icon} ${esc(w.name)}</option>`).join('')}</select>
    <label for="xto">Sang ví</label><select id="xto">${state.wallets.map((w) => `<option value="${w.id}" ${w.id === 'momo' ? 'selected' : ''}>${w.icon} ${esc(w.name)}</option>`).join('')}</select>
    <label for="xamt">Số tiền (VD: 100k)</label><input id="xamt" placeholder="100k" required />
    <div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn" id="cancel-dlg" style="flex:1">Hủy</button><button type="submit" class="btn primary" style="flex:2">Chuyển tiền</button></div>
  </form>`;
  dlg.querySelector('#cancel-dlg').onclick = () => dlg.close();
  dlg.querySelector('#xferform').onsubmit = (e) => {
    e.preventDefault();
    const fromId = dlg.querySelector('#xfrom').value;
    const toId = dlg.querySelector('#xto').value;
    const amt = L.parseAmount(dlg.querySelector('#xamt').value);
    if (fromId === toId) { toast('Chọn 2 ví khác nhau.'); return; }
    if (!(amt > 0)) { toast('Nhập số tiền hợp lệ.'); return; }
    const today = L.todayStr();
    state.transactions.push(
      { id: L.uid(), type: 'expense', amount: amt, categoryId: 'other-exp', walletId: fromId, date: today, note: `Chuyển sang ${wallet(toId).shortName}` },
      { id: L.uid(), type: 'income', amount: amt, categoryId: 'other-inc', walletId: toId, date: today, note: `Nhận từ ${wallet(fromId).shortName}` }
    );
    save(); dlg.close(); render(); toast(`Đã chuyển ${L.formatVND(amt)} sang ${wallet(toId).shortName}`);
  };
  dlg.showModal();
}

function openQRModal(rv) {
  dlg.innerHTML = `<div style="text-align:center"><h2 style="margin:0 0 6px">Mã QR Voucher</h2><p class="mute">${esc(rv.merchant)}</p><p style="font-weight:800">${esc(rv.title)}</p><div style="display:inline-block;padding:16px;background:#fff;border-radius:18px;border:1px solid #ddd"><svg width="140" height="140" viewBox="0 0 70 70">${Array.from({ length: 49 }, (_, i) => ((i * 7 + rv.code.charCodeAt(i % rv.code.length)) % 2 === 0 ? `<rect x="${(i % 7) * 10}" y="${Math.floor(i / 7) * 10}" width="8" height="8" rx="1.5" fill="#183C35"/>` : '')).join('')}</svg></div><p class="mono" style="font-size:1.1rem;font-weight:800">${esc(rv.code)}</p><button type="button" class="btn primary block" id="close-qr">Xong</button></div>`;
  dlg.querySelector('#close-qr').onclick = () => dlg.close();
  dlg.showModal();
}

document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) { ui.tab = tabBtn.dataset.tab; render(); return; }
  const planBtn = e.target.closest('[data-plantab]');
  if (planBtn) { ui.planTab = planBtn.dataset.plantab; render(); return; }
  const walBtn = e.target.closest('[data-wallet]');
  if (walBtn) { ui.walletFilter = walBtn.dataset.wallet; render(); return; }
  const scBtn = e.target.closest('[data-scope]');
  if (scBtn) { ui.boardScope = scBtn.dataset.scope; render(); return; }
  const rgBtn = e.target.closest('[data-range]');
  if (rgBtn) { ui.trendRange = Number(rgBtn.dataset.range); render(); return; }
  const prBtn = e.target.closest('[data-prompt]');
  if (prBtn) {
    const q = prBtn.dataset.prompt;
    state.chatHistory.push({ id: L.uid(), role: 'user', text: q }, { id: L.uid(), role: 'assistant', text: L.answerAIChat(q, state, ui.month, L.todayStr()) });
    save(); render(); return;
  }

  const act = e.target.closest('[data-act]');
  if (!act) return;
  const { act: a, id } = act.dataset;
  const today = L.todayStr();

  if (a === 'add') openAddTx();
  else if (a === 'addcat') openAddTx(id);
  else if (a === 'mprev') { ui.month = L.shiftMonth(ui.month, -1); render(); }
  else if (a === 'mnext') { ui.month = L.shiftMonth(ui.month, 1); render(); }
  else if (a === 'toggledark') { state.darkMode = !state.darkMode; save(); render(); }
  else if (a === 'gojars') { ui.tab = 'plan'; ui.planTab = 'jars'; render(); }
  else if (a === 'gorewards') { ui.tab = 'rewards'; render(); }
  else if (a === 'checkin' && state.lastCheckInDate !== today) {
    state.streakDays += 1; state.lastCheckInDate = today; state.finPoints += 15;
    state.pointHistory.unshift({ id: L.uid(), title: `Điểm danh ngày ${state.streakDays}`, points: 15, date: today });
    save(); render(); toast('Điểm danh thành công! +15 FinPoints');
  } else if (a === 'claimweek') {
    const wk = currentWeekKey(today);
    if (state.weeklyBudgetBonusClaimedWeek !== wk) {
      state.weeklyBudgetBonusClaimedWeek = wk;
      state.finPoints += 50;
      state.pointHistory.unshift({ id: L.uid(), title: 'Thưởng giữ vững ngân sách tuần', points: 50, date: today });
      save(); render(); toast('Nhận +50 FinPoints giữ vững ngân sách!');
    }
  } else if (a === 'deltx') {
    const idx = state.transactions.findIndex((t) => t.id === id);
    if (idx >= 0) {
      const [gone] = state.transactions.splice(idx, 1);
      save(); render();
      toast('Đã xóa giao dịch', () => { state.transactions.splice(idx, 0, gone); save(); render(); });
    }
  } else if (a === 'applyautobudget') {
    const plan = L.generateAutoBudgetPlan(Number(id) || 1_800_000);
    state.budgets = [{ id: 'b-all', categoryId: null, limit: plan.totalLimit }, ...plan.allocations.map((x) => ({ id: 'b-' + x.categoryId, categoryId: x.categoryId, limit: x.limit }))];
    save(); render(); toast('Đã áp dụng ngân sách AI');
  } else if (a === 'delbudget') {
    state.budgets = state.budgets.filter((b) => b.id !== id); save(); render();
  } else if (a === 'jar100' || a === 'jar250') {
    const amt = a === 'jar100' ? 100_000 : 250_000;
    const j = state.jars.find((x) => x.id === id);
    if (j) {
      const wasDone = L.goalPct(j) >= 100;
      j.contributions.push({ amount: amt, date: today });
      if (!wasDone && L.goalPct(j) >= 100) {
        state.finPoints += 50;
        state.pointHistory.unshift({ id: L.uid(), title: `Hoàn thành hũ ${j.name}`, points: 50, date: today });
        toast(`Hoàn thành hũ ${j.name}! +50 FinPoints`);
      } else {
        toast(`Đã góp ${L.formatVND(amt)}`);
      }
      save(); render();
    }
  } else if (a === 'deljar') {
    state.jars = state.jars.filter((j) => j.id !== id); save(); render();
  } else if (a === 'settledebt') {
    const d = state.debts.find((x) => x.id === id);
    if (d && !d.settled) {
      d.settled = true;
      state.transactions.push({ id: L.uid(), type: d.direction === 'lend' ? 'income' : 'expense', amount: d.amount, categoryId: d.direction === 'lend' ? 'other-inc' : 'other-exp', walletId: d.walletId, date: today, note: `Tất toán với ${d.personName}` });
      save(); render(); toast(`Đã tất toán với ${d.personName}`);
    }
  } else if (a === 'redeem') {
    const v = L.MAC_DINH_CHI_VOUCHERS.find((x) => x.id === id);
    if (v && state.finPoints >= v.costPoints) {
      state.finPoints -= v.costPoints;
      const rv = { id: L.uid(), merchant: v.merchant, title: v.title, discountLabel: v.discountLabel, code: `FM-MDC-${Math.floor(1000 + Math.random() * 9000)}`, redeemedAt: today, used: false };
      state.redeemedVouchers.unshift(rv);
      state.pointHistory.unshift({ id: L.uid(), title: `Đổi ${v.discountLabel}`, points: -v.costPoints, date: today });
      save(); render(); openQRModal(rv);
    }
  } else if (a === 'openqr') {
    const rv = state.redeemedVouchers.find((x) => x.id === id);
    if (rv) openQRModal(rv);
  } else if (a === 'togglepremium') {
    state.isPremium = !state.isPremium; save(); render();
  } else if (a === 'banksync') {
    const tpl = L.BANK_SYNC_FEED[state.transactions.length % L.BANK_SYNC_FEED.length];
    state.transactions.push({ ...tpl, id: L.uid(), date: today });
    state.bankSync.lastSyncedAt = `${today} ${new Date().toTimeString().slice(0, 5)}`;
    save(); render(); toast(`Đã đồng bộ giao dịch ${L.formatVND(tpl.amount)}`);
  } else if (a === 'exportcsv') {
    downloadFile('BaoCao_FinMate.csv', L.toCSV(state.transactions, state.categories, state.wallets), 'text/csv;charset=utf-8');
    toast('Đã tải BaoCao_FinMate.csv');
  } else if (a === 'exportjson') {
    downloadFile(`finmate-backup-${today}.json`, JSON.stringify(state, null, 2), 'application/json');
    toast('Đã xuất file JSON');
  } else if (a === 'importjson') {
    $('#json-import')?.click();
  } else if (a === 'reset') {
    state = L.createSeedState(); save(); render(); toast('Đã khôi phục dữ liệu mẫu');
  } else if (a === 'addbudget') {
    openBudgetModal();
  } else if (a === 'addjar') {
    openJarModal();
  } else if (a === 'adddebt') {
    openDebtModal();
  } else if (a === 'transfer') {
    openTransferModal();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'json-import') {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((txt) => {
      try {
        const parsed = JSON.parse(txt);
        if (parsed && Array.isArray(parsed.transactions)) {
          state = parsed;
          save(); render(); toast('Đã khôi phục dữ liệu JSON');
        } else {
          toast('File JSON không hợp lệ.');
        }
      } catch {
        toast('Không đọc được file JSON.');
      }
    });
    e.target.value = '';
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'q') {
    ui.query = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const inp = $('#q');
    if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'chatform') {
    e.preventDefault();
    const val = $('#chat-input').value.trim();
    if (!val) return;
    state.chatHistory.push({ id: L.uid(), role: 'user', text: val }, { id: L.uid(), role: 'assistant', text: L.answerAIChat(val, state, ui.month, L.todayStr()) });
    save(); render();
  } else if (e.target.id === 'profileform') {
    e.preventDefault();
    state.profile.name = $('#pname').value.trim() || 'Minh Anh';
    state.profile.className = ($('#pclass').value.trim() || '10A10').toUpperCase();
    state.profile.grade = Number($('#pgrade').value) || 10;
    save(); render(); toast('Đã lưu hồ sơ');
  }
});

render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
