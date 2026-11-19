import * as L from './logic.js';
import { cloudAuth, validateNewAccount, MIN_PASSWORD } from './auth.js';

let account = null, state = L.emptyState();
const thisMonth = () => L.monthKey(L.todayStr());
let ui = { tab: 'home', plan: 'budget', q: '', month: thisMonth(), recent: [], entered: false, syncStatus: 'synced' };

const cacheKey = () => `finmate:cache:${account?.id}`;
let syncTimer = null;

function save() {
  if (!account) return;
  try {
    localStorage.setItem(cacheKey(), JSON.stringify({ state, recent: ui.recent }));
  } catch {
    toast('Không lưu được bộ nhớ đệm trên trình duyệt.');
  }

  ui.syncStatus = 'syncing';
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await cloudAuth.saveState(account.id, state, ui.recent);
      ui.syncStatus = 'synced';
      if (ui.tab === 'settings') render();
    } catch (e) {
      console.warn('Cloud sync failed', e);
      ui.syncStatus = 'offline';
      if (ui.tab === 'settings') render();
      toast('Chưa đồng bộ được lên đám mây. Dữ liệu đã lưu tạm trên máy.');
    }
  }, 600);
}

function pushRecent(id) {
  ui.recent = [id, ...ui.recent.filter((x) => x !== id)].slice(0, 6);
  save();
}

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FALLBACK = Object.fromEntries(L.DEFAULT_CATEGORIES.map((c) => [c.id, c.color]));
const cat = (id) => { const c = state.categories.find((x) => x.id === id) || { name: id, icon: '❓' }; return { ...c, color: FALLBACK[id] || c.color || '#A9B5AE' }; };
const monthLabel = (m) => `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`;
const vnd = L.formatVND;
function dayLabel(d) {
  const t = L.todayStr(), y = new Date(); y.setDate(y.getDate() - 1);
  if (d === t) return 'Hôm nay'; if (d === L.todayStr(y)) return 'Hôm qua';
  const [Y, M, D] = d.split('-').map(Number); const w = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(Y, M - 1, D).getDay()];
  return `${w}, ${D}/${M}`;
}
function toast(msg, action) {
  const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`; t.hidden = false;
  if (action) t.querySelector('button').onclick = () => { action.run(); t.hidden = true; };
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), action ? 5000 : 2400);
}
const meter = (pct, cls = '', color = '') => {
  const W = 300, p = Math.min(pct, 100), x1 = p > 0 ? Math.max((W * p) / 100, 8) : 0; let d = '';
  for (let x = 0; x <= x1; x += 2) d += `${x ? 'L' : 'M'}${x.toFixed(1)} ${(8 + 3 * Math.sin((x / W) * 14 * 2 * Math.PI)).toFixed(2)} `;
  return `<div class="meter ${cls}" style="${color ? `--c:${color}` : ''}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><svg viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">${p < 100 ? `<line class="trk" x1="${x1}" y1="8" x2="${W}" y2="8"/>` : ''}${x1 ? `<path class="fill" d="${d}"/>` : ''}</svg></div>`;
};
const cookie = (cx, cy, R, n, amp) => { let d = ''; for (let k = 0; k <= 120; k++) { const t = (k / 120) * 2 * Math.PI, r = R + amp * Math.cos(n * t); d += `${k ? 'L' : 'M'}${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)} `; } return d + 'Z'; };
const txRow = (t) => { const c = cat(t.categoryId); return `<div class="tx"><span class="bubble" style="--c:${c.color}">${c.icon}</span>
  <div class="grow"><div class="t">${esc(c.name)}</div>${t.note ? `<div class="n">${esc(t.note)}</div>` : ''}</div>
  <span class="amt num ${t.type === 'income' ? 'in' : ''}">${t.type === 'income' ? '+' : '−'}${vnd(t.amount)}</span>
  <button class="x" data-act="deltx" data-id="${t.id}" aria-label="Xóa giao dịch">✕</button></div>`; };
const ART = {
  coins: ['#F8DCCB', '<circle cx="64" cy="54" r="26" fill="#F7E7A8"/><text x="64" y="64" text-anchor="middle" font-size="26" font-weight="800" fill="#183C35">₫</text><circle cx="110" cy="76" r="16" fill="#E1F5EC"/><circle cx="110" cy="76" r="6" fill="#183C35"/>'],
  target: ['#E8DDF8', '<circle cx="80" cy="62" r="32" fill="#fff"/><circle cx="80" cy="62" r="22" fill="#E8DDF8"/><circle cx="80" cy="62" r="10" fill="#183C35"/><path d="M80 62l28-28" stroke="#E8C547" stroke-width="5" stroke-linecap="round"/>'],
  sprout: ['#E1F5EC', '<rect x="57" y="76" width="46" height="26" rx="12" fill="#183C35"/><path d="M80 76V52" stroke="#183C35" stroke-width="5" stroke-linecap="round"/><path d="M80 58c-17 0-23-11-23-23 15 0 23 8 23 23z" fill="#5FBF9A"/><path d="M80 52c13 0 19-9 19-19-13 0-19 7-19 19z" fill="#F7E7A8"/>'],
};
const art = (k) => `<svg class="art" viewBox="0 0 160 124" aria-hidden="true"><path d="${cookie(80, 62, 50, 9, 4)}" fill="${ART[k][0]}"/>${ART[k][1]}</svg>`;
const empty = (kind, title, text, btn) => `<div class="empty">${art(kind)}<b>${title}</b>${text}${btn || ''}</div>`;
const FLOW = { data: [], x: [] };
const flowRead = (d) => `<b>${monthLabel(d.month)}</b><span class="k in">Thu ${vnd(d.income)}</span><span class="k out">Chi ${vnd(d.expense)}</span>`;
function flowChart() {
  const data = L.monthlyFlow(state.transactions, ui.month, 6), n = data.length; FLOW.data = data;
  const maxV = Math.max(...data.flatMap((d) => [d.income, d.expense]));
  if (!maxV) return empty('coins', 'Chưa có dữ liệu dòng tiền', 'Ghi vài giao dịch để xem thu chi thay đổi theo từng tháng.');
  const W = 320, H = 176, pl = 40, pr = 12, pt = 12, pb = 28, top = L.niceMax(maxV), last = n - 1;
  const X = (i) => pl + (i * (W - pl - pr)) / (n - 1), Y = (v) => pt + (1 - v / top) * (H - pt - pb); FLOW.x = data.map((_, i) => X(i));
  const smooth = (vals) => { const p = vals.map((v, i) => [X(i), Y(v)]), cl = (y) => Math.min(H - pb, Math.max(pt, y)); let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) { const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${cl(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${cl(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; } return d; };
  const inc = data.map((d) => d.income), exp = data.map((d) => d.expense), hw = (W - pl - pr) / (n - 1);
  const grid = [0, top / 2, top].map((v) => `<line class="g" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pl - 8}" y="${Y(v) + 3}" text-anchor="end">${v ? L.compactVND(v) : '0'}</text>`).join('');
  const dots = (vals, cls) => vals.map((v, i) => `<circle class="${cls}${i === last ? ' sel' : ''}" data-dot="${i}" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === last ? 6 : 4}"/>`).join('');
  const labels = data.map((d, i) => `<text class="${i === last ? 'sel' : ''}" data-lab="${i}" x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">T${Number(d.month.slice(5))}</text>`).join('');
  const hits = data.map((_, i) => `<rect data-hit="${i}" x="${(X(i) - hw / 2).toFixed(1)}" y="0" width="${hw.toFixed(1)}" height="${H - pb}"/>`).join('');
  return `<div class="flow-card" id="flow"><div class="flow-read" id="flowread" aria-live="polite">${flowRead(data[last])}</div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ thu và chi 6 tháng gần nhất">${grid}
      <path class="area" d="${smooth(inc)} L${X(last).toFixed(1)} ${H - pb} L${X(0).toFixed(1)} ${H - pb} Z"/>
      <line class="guide" x1="${X(last).toFixed(1)}" x2="${X(last).toFixed(1)}" y1="${pt}" y2="${H - pb}"/>
      <path class="ln out" d="${smooth(exp)}"/><path class="ln in" d="${smooth(inc)}"/>${dots(exp, 'out')}${dots(inc, 'in')}${labels}${hits}</svg></div>`;
}
function setFlow(i) {
  const d = FLOW.data[i], root = $('#flow'); if (!d || !root) return;
  $('#flowread').innerHTML = flowRead(d);
  const g = root.querySelector('.guide'); g.setAttribute('x1', FLOW.x[i].toFixed(1)); g.setAttribute('x2', FLOW.x[i].toFixed(1));
  root.querySelectorAll('[data-dot]').forEach((c) => { const on = Number(c.dataset.dot) === i; c.classList.toggle('sel', on); c.setAttribute('r', on ? 6 : 4); });
  root.querySelectorAll('[data-lab]').forEach((c) => c.classList.toggle('sel', Number(c.dataset.lab) === i));
}
function donut(entries, total) {
  const R = 46, C = 2 * Math.PI * R, gap = entries.length > 1 ? 6 : 0; let start = 0;
  const segs = entries.map(([id, v]) => { const len = Math.max((v / total) * C - gap, 2); const el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${cat(id).color}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-start}"/>`; start += (v / total) * C; return el; }).join('');
  return `<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Biểu đồ chi tiêu theo danh mục"><g transform="rotate(-90 60 60)"><circle cx="60" cy="60" r="${R}" fill="none" stroke="#E1F5EC" stroke-width="16"/>${segs}</g>
    <text x="60" y="58" text-anchor="middle" font-size="19" font-weight="800">${L.compactVND(total)}</text><text x="60" y="73" text-anchor="middle" font-size="9" font-weight="600" style="fill:#777E79">đã chi</text></svg>`;
}

/* ---------- screens ---------- */
function home() {
  const today = L.todayStr(), s = L.summarize(state.transactions, ui.month);
  const overall = state.budgets.find((b) => b.categoryId === null);
  const al = overall ? L.dailyAllowance(overall.limit, s.expense, ui.month, today) : null;
  let label, num, numCls = '', sub, sub2 = '';
  if (overall) {
    const remaining = overall.limit - s.expense, over = remaining < 0;
    label = over ? 'Bạn đã vượt ngân sách' : 'Ngân sách còn lại'; num = (over ? '−' : '') + vnd(Math.abs(remaining)); numCls = over ? 'over' : '';
    sub = `Ngân sách bạn đặt: ${vnd(overall.limit)}`;
    if (al && !over) sub2 = `Khoảng ${vnd(al.perDay)} mỗi ngày · còn ${al.daysLeft} ngày`;
  } else { label = 'Số dư ' + monthLabel(ui.month).toLowerCase(); num = vnd(s.balance); sub = 'Đặt ngân sách để biết bạn còn bao nhiêu tiền để tiêu.'; }
  const daily = L.dailySpend(state.transactions, ui.month), max = Math.max(...daily, 1), n = daily.length;
  const todayDay = ui.month === thisMonth() ? Number(today.slice(8)) : ui.month < thisMonth() ? n + 1 : 0;
  const strip = daily.map((v, i) => { const d = i + 1; const cls = [d === todayDay ? 'today' : '', d > todayDay ? 'future' : '', v ? '' : 'zero'].join(' ');
    return `<i class="${cls}" style="--h:${v ? Math.max(10, Math.round((v / max) * 100)) : 0}%;--i:${i}" title="Ngày ${d}: ${vnd(v)}"></i>`; }).join('');
  const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  const recent = state.transactions.filter((t) => L.monthKey(t.date) === ui.month).sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1)).slice(0, 4);
  const arrow = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  const daysLeftBadge = ui.month === thisMonth() ? n - Number(today.slice(8)) + 1 : 0;
  const badge = daysLeftBadge ? `<svg class="badge" viewBox="0 0 100 100" role="img" aria-label="Còn ${daysLeftBadge} ngày trong tháng"><path d="${cookie(50, 50, 42, 10, 4)}" fill="#F7E7A8"/><text x="50" y="55" text-anchor="middle" font-size="30" font-weight="800" fill="#183C35">${daysLeftBadge}</text><text x="50" y="71" text-anchor="middle" font-size="11" font-weight="700" fill="#183C35">ngày</text></svg>` : '';
  const quickIds = [...ui.recent.filter((id) => cat(id).type === 'expense'), ...state.categories.filter((c) => c.type === 'expense').map((c) => c.id)].filter((id, i, arr) => arr.indexOf(id) === i && state.categories.some((c) => c.id === id)).slice(0, 5);
  const tints = ['var(--peach)', 'var(--tertiary)', 'var(--lavender)', 'var(--secondary)', 'var(--peach)'];
  const quick = `<section class="sec"><div class="sec-head"><h2>Thêm nhanh</h2></div><div class="quick">${quickIds.map((id, i) => `<button class="q" data-act="addcat" data-id="${id}"><span class="qc" style="--t:${tints[i]}">${cat(id).icon}</span><small>${esc(cat(id).name)}</small></button>`).join('')}</div></section>`;
  const html = `<section class="hero" aria-label="Tóm tắt tháng">${badge}
    <p class="hero-label">${label}</p><p class="hero-num num ${numCls}">${num}</p><div class="hero-subs"><p class="hero-sub">${sub}</p>${sub2 ? `<p class="hero-sub2">${sub2}</p>` : ''}</div>
    <div class="strip ${ui.entered ? '' : 'enter'}" role="img" aria-label="Chi tiêu từng ngày trong tháng">${strip}</div>
    <div class="axis"><span>1</span><span>${Math.ceil(n / 2)}</span><span>${n}</span></div>
    <div class="hero-actions"><button class="btn primary" data-act="add">Thêm chi tiêu</button><button class="btn tonal" data-act="${overall ? 'editbudget' : 'addbudget'}"${overall ? ` data-id="${overall.id}"` : ''}>${overall ? 'Sửa ngân sách' : 'Đặt ngân sách'}</button></div></section>
  <section class="stats" aria-label="Thu và chi trong tháng">
    <div class="stat a" style="--bg-c:var(--peach)"><span class="ico">${arrow('M7 17L17 7M9 7h8v8')}</span><small>Đã chi</small><b class="num">${vnd(s.expense)}</b></div>
    <div class="stat b" style="--bg-c:var(--tertiary)"><span class="ico">${arrow('M17 7L7 17M15 17H7V9')}</span><small>Đã thu</small><b class="num">${vnd(s.income)}</b></div></section>
  ${quick}
  <section class="sec"><div class="sec-head"><h2>Tiền đã đi đâu</h2></div>
    ${cats.length ? `<div class="donut-card">${donut(cats, s.expense)}<ul class="legend">${cats.map(([id, v]) => `<li><span class="dot" style="--c:${cat(id).color}"></span><div><b>${cat(id).icon} ${esc(cat(id).name)}</b><small class="num">${v >= 1_000_000 ? L.compactVND(v) : vnd(v)} · ${v / s.expense > 0 && Math.round((v / s.expense) * 100) === 0 ? '&lt;1' : Math.round((v / s.expense) * 100)}%</small></div></li>`).join('')}</ul></div>`
      : empty('coins', 'Chưa có khoản chi nào', 'Bấm Thêm để ghi khoản chi đầu tiên của tháng.')}</section>
  <section class="sec"><div class="sec-head"><h2>Dòng tiền 6 tháng</h2></div>${flowChart()}</section>
  <section class="sec"><div class="sec-head"><h2>Gần đây</h2>${recent.length ? '<button class="linkbtn" data-tab-go="tx">Xem tất cả</button>' : ''}</div>
    ${recent.length ? `<div class="list">${recent.map((t) => txRow(t)).join('')}</div>` : ''}</section>`;
  ui.entered = true; return html;
}

function txListHtml() {
  const q = ui.q.trim();
  const list = state.transactions.filter((t) => (q ? L.matchTx(t, q, cat(t.categoryId).name) : L.monthKey(t.date) === ui.month)).sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
  if (!list.length) return q ? empty('coins', 'Không tìm thấy giao dịch', `Không có kết quả cho "${esc(q)}". Thử từ khóa khác.`)
    : empty('coins', 'Chưa có giao dịch trong tháng này', 'Mỗi khoản thu chi bạn ghi sẽ hiện ở đây.', '<br><button class="btn primary" data-act="add">Thêm giao dịch</button>');
  const groups = {}; for (const t of list) (groups[t.date] ||= []).push(t);
  return `<div class="list">${Object.entries(groups).map(([d, items]) => {
    const net = items.reduce((a, t) => a + (t.type === 'income' ? t.amount : -t.amount), 0);
    return `<div class="day"><span>${q ? d.split('-').reverse().join('/') : dayLabel(d)}</span><span class="num">${net > 0 ? '+' : net < 0 ? '−' : ''}${vnd(Math.abs(net))}</span></div>${items.map(txRow).join('')}`; }).join('')}</div>`;
}
function txs() {
  return `<div class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.500-3.500"/></svg><input id="q" type="search" value="${esc(ui.q)}" placeholder="Tìm theo ghi chú hoặc danh mục" aria-label="Tìm giao dịch" autocomplete="off"></div>
    <p class="hint" id="qhint">${ui.q.trim() ? 'Đang tìm trong tất cả các tháng.' : ''}</p><div id="txlist">${txListHtml()}</div>`;
}

function plan() {
  const seg = `<div class="seg" role="group" aria-label="Chọn kế hoạch"><button aria-pressed="${ui.plan === 'budget'}" data-plan="budget">Ngân sách</button><button aria-pressed="${ui.plan === 'goals'}" data-plan="goals">Mục tiêu tiết kiệm</button></div>`;
  if (ui.plan === 'budget') {
    const st = L.budgetStatus(state.budgets, state.transactions, ui.month);
    return seg + `<p class="hint" style="margin:12px 2px">Ngân sách áp dụng cho mọi tháng. Số liệu bên dưới là của ${monthLabel(ui.month).toLowerCase()}.</p>` +
      (st.length ? st.map((b) => { const c = b.categoryId ? cat(b.categoryId) : { icon: '💰', name: 'Tổng chi tiêu', color: '#5FBF9A' };
        return `<article class="card plan"><div class="plan-top"><span class="bubble" style="--c:${c.color}">${c.icon}</span><div class="grow"><b>${esc(c.name)}</b><div class="mute" style="color:var(--mute);font-size:.85rem">Hạn mức ${vnd(b.limit)}</div></div>
          <button class="x" data-act="editbudget" data-id="${b.id}" aria-label="Sửa hạn mức">✎</button><button class="x" data-act="delbudget" data-id="${b.id}" aria-label="Xóa ngân sách">✕</button></div>
          ${meter(b.pct, b.over ? 'over' : b.warn ? 'warn' : '', b.categoryId ? c.color : '')}
          <div class="plan-foot num"><span>Đã dùng ${vnd(b.spent)} (${b.pct}%)</span><span class="${b.over ? 'bad' : ''}">${b.over ? 'Vượt ' + vnd(-b.remaining) : 'Còn ' + vnd(b.remaining)}</span></div></article>`; }).join('')
        : `<div class="list" style="margin-top:12px">${empty('sprout', 'Chưa có ngân sách', 'Đặt một tổng ngân sách để màn hình Hôm nay cho bạn biết mỗi ngày tiêu được bao nhiêu.')}</div>`) +
      '<button class="btn primary block" data-act="addbudget">Đặt ngân sách</button>';
  }
  return seg + (state.goals.length ? state.goals.map((g) => { const pct = L.goalPct(g);
    return `<article class="card plan"><div class="plan-top"><span class="bubble" style="--c:#E8C547">🎯</span><div class="grow"><b>${esc(g.name)}</b>${g.deadline ? `<div style="color:var(--mute);font-size:.85rem">Hạn ${g.deadline.split('-').reverse().join('/')}</div>` : ''}</div>
      <span class="big num">${pct}%</span><button class="x" data-act="delgoal" data-id="${g.id}" aria-label="Xóa mục tiêu">✕</button></div>
      ${meter(pct, '', '')}<div class="plan-foot num"><span>${vnd(L.goalSaved(g))} / ${vnd(g.target)}</span><span>${pct >= 100 ? 'Đã đạt mục tiêu 🎉' : 'Còn ' + vnd(g.target - L.goalSaved(g))}</span></div>
      <div class="row-actions" style="margin:0"><button class="btn" data-act="contrib" data-id="${g.id}">Góp tiền</button><button class="btn" data-act="contrib250" data-id="${g.id}">+250k</button></div></article>`; }).join('')
    : `<div class="list" style="margin-top:12px">${empty('target', 'Chưa có mục tiêu', 'Đặt một món bạn muốn mua hoặc một khoản muốn dành dụm, rồi góp dần.')}</div>`) +
    '<button class="btn primary block" data-act="addgoal">Tạo mục tiêu</button>';
}

function settings() {
  const syncLabel = ui.syncStatus === 'syncing'
    ? 'Đang đồng bộ lên đám mây…'
    : ui.syncStatus === 'offline'
      ? 'Đang ngoại tuyến (đã lưu tạm trên máy)'
      : 'Đã đồng bộ lên đám mây';

  return `<section class="card"><h2>Tài khoản đám mây</h2>
    <p>Đang đăng nhập: <b>${esc(account.name)}</b> (${esc(account.email)})</p>
    <p class="hint" style="margin-top:4px">Trạng thái: <b>${syncLabel}</b></p>
    <div class="row-actions"><button class="btn primary" data-act="logout">Đăng xuất</button><button class="btn" data-act="chpass">Đổi mật khẩu</button></div>
  </section>
  <section class="card"><h2>Sao lưu & xuất dữ liệu</h2><p>Dữ liệu tự động đồng bộ trên mọi thiết bị của bạn. Bạn cũng có thể tải bản sao lưu thủ công bất cứ lúc nào.</p>
    <div class="row-actions"><button class="btn primary" data-act="exportjson">Sao lưu (JSON)</button><button class="btn" data-act="exportcsv">Xuất CSV</button><button class="btn" data-act="import">Khôi phục từ file</button></div>
    <input id="file" type="file" accept="application/json" hidden></section>
  <section class="card"><h2>Quyền riêng tư</h2><p>FinMate không hỏi mật khẩu ngân hàng và không giữ tiền. Dữ liệu tài chính của bạn được bảo vệ theo tài khoản cá nhân trên đám mây.</p>
    <div class="row-actions"><button class="btn danger" data-act="wipe">Xóa toàn bộ dữ liệu của tôi</button></div></section>`;
}

const SCREENS = { home: ['Hôm nay', home, true], tx: ['Giao dịch', txs, true], plan: ['Kế hoạch', plan, false], settings: ['Cài đặt', settings, false] };
function render() {
  if (!account) return;
  const [title, fn, monthly] = SCREENS[ui.tab];
  const showMonth = monthly || (ui.tab === 'plan' && ui.plan === 'budget');
  $('#bar').innerHTML = `<h1>${title}</h1>${showMonth ? `<div class="pill"><button data-act="mprev" aria-label="Tháng trước">‹</button><b>${monthLabel(ui.month)}</b><button data-act="mnext" aria-label="Tháng sau">›</button></div>` : ''}`;
  $('#view').innerHTML = fn();
  document.querySelectorAll('#nav [data-tab]').forEach((b) => { if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}

/* ---------- sheets ---------- */
const dlg = $('#dlg');
function sheet(title, body, submitLabel, onSubmit) {
  dlg.innerHTML = `<form class="sheet" id="f" novalidate><h2>${title}</h2>${body}<div class="sheet-actions"><button type="button" class="btn" data-close>Hủy</button><button class="btn primary" type="submit">${submitLabel}</button></div></form>`;
  dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.querySelector('#f').onsubmit = (e) => { e.preventDefault(); if (onSubmit(new FormData(e.target)) !== false) dlg.close(); };
  dlg.showModal();
}
const money = (name = 'amount', ph = '0') => `<div class="money"><input id="${name}" name="${name}" inputmode="decimal" autocomplete="off" placeholder="${ph}" aria-label="Số tiền"><span>₫</span></div><p class="hint" id="${name}-hint">Gõ 50k, 50.000 hoặc 1,5tr</p>`;
function wireMoney(name) {
  const i = dlg.querySelector('#' + name), h = dlg.querySelector('#' + name + '-hint');
  i.addEventListener('input', () => { const v = L.parseAmount(i.value); h.textContent = i.value && !Number.isNaN(v) ? '= ' + vnd(v) : i.value ? 'Chưa hiểu số tiền này. Thử 50k hoặc 50.000.' : 'Gõ 50k, 50.000 hoặc 1,5tr'; });
  return i;
}
const need = (v) => { const n = L.parseAmount(v); if (!(n > 0)) { toast('Nhập số tiền lớn hơn 0.'); return null; } return n; };

function addTx(pre) {
  let type = 'expense', catId = (typeof pre === 'string' && pre) || ui.recent.find((id) => cat(id).type === 'expense') || 'food';
  sheet('Thêm giao dịch', `<div class="seg type" data-type="expense" id="types"><button type="button" data-type="expense">Chi</button><button type="button" data-type="income">Thu</button></div>
    ${money()}<div class="chips" id="quick">${[10000, 20000, 50000, 100000].map((v) => `<button type="button" class="chip quick" data-add="${v}">+${v / 1000}k</button>`).join('')}</div>
    <label>Danh mục</label><div class="chips" id="cats"></div>
    <label for="date">Ngày</label><input id="date" name="date" type="date" value="${L.todayStr()}" max="${L.todayStr()}">
    <label for="note">Ghi chú (không bắt buộc)</label><input id="note" name="note" maxlength="80" placeholder="VD: trà sữa với bạn">`, 'Lưu giao dịch', (fd) => {
    const amount = need(fd.get('amount')); if (!amount) return false;
    const date = fd.get('date') || L.todayStr();
    state.transactions.push({ id: L.uid(), type, amount, categoryId: catId, date, note: fd.get('note').trim() });
    pushRecent(catId); ui.month = L.monthKey(date); save(); render(); toast('Đã lưu giao dịch');
  });
  const amountEl = wireMoney('amount');
  const draw = () => {
    const cats = state.categories.filter((c) => c.type === type);
    if (!cats.some((c) => c.id === catId)) catId = cats[0].id;
    const rank = (id) => { const i = ui.recent.indexOf(id); return i < 0 ? 99 : i; };
    dlg.querySelector('#cats').innerHTML = [...cats].sort((a, b) => rank(a.id) - rank(b.id)).map((c) => `<button type="button" class="chip" style="--c:${cat(c.id).color}" aria-pressed="${c.id === catId}" data-cat="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('');
    dlg.querySelector('#types').dataset.type = type;
    dlg.querySelectorAll('[data-type]').forEach((b) => b.tagName === 'BUTTON' && b.setAttribute('aria-pressed', b.dataset.type === type));
  };
  dlg.querySelector('#f').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.type) { type = b.dataset.type; draw(); }
    if (b.dataset.cat) { catId = b.dataset.cat; draw(); }
    if (b.dataset.add) { const cur = L.parseAmount(amountEl.value); amountEl.value = String((Number.isNaN(cur) ? 0 : cur) + Number(b.dataset.add)); amountEl.dispatchEvent(new Event('input')); amountEl.focus(); }
  });
  draw(); amountEl.focus();
}
function addBudget(prefill) {
  const editing = prefill && typeof prefill === 'object' ? prefill : null;
  const opts = ['<option value="">Tổng chi tiêu cả tháng</option>', ...state.categories.filter((c) => c.type === 'expense').map((c) => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`)].join('');
  sheet(editing ? 'Sửa ngân sách' : 'Đặt ngân sách', `<label for="c">Áp dụng cho</label><select id="c" name="c"${editing ? ' disabled' : ''}>${opts}</select>${editing ? '<p class="hint">Muốn đổi danh mục? Xóa ngân sách này rồi tạo cái mới.</p>' : ''}<label>Hạn mức mỗi tháng</label>${money('limit')}`, 'Lưu ngân sách', (fd) => {
    const limit = need(fd.get('limit')); if (!limit) return false;
    if (editing) { const b = state.budgets.find((x) => x.id === editing.id); if (b) b.limit = limit; }
    else {
      const categoryId = fd.get('c') || null, existing = state.budgets.find((b) => b.categoryId === categoryId);
      if (existing) existing.limit = limit; else state.budgets.push({ id: L.uid(), categoryId, limit });
    }
    save(); render(); toast(editing ? 'Đã cập nhật ngân sách' : 'Đã lưu ngân sách');
  });
  const limitEl = wireMoney('limit');
  if (editing) { dlg.querySelector('#c').value = editing.categoryId || ''; limitEl.value = String(editing.limit); limitEl.dispatchEvent(new Event('input')); limitEl.select(); }
  else limitEl.focus();
}
function addGoal() {
  sheet('Tạo mục tiêu tiết kiệm', `<label for="n">Bạn muốn dành tiền cho gì?</label><input id="n" name="n" maxlength="60" placeholder="VD: Laptop mới">
    <label>Số tiền cần đạt</label>${money('target')}<label for="d">Hạn (không bắt buộc)</label><input id="d" name="d" type="date">`, 'Tạo mục tiêu', (fd) => {
    const name = fd.get('n').trim(); if (!name) { toast('Nhập tên mục tiêu.'); return false; }
    const target = need(fd.get('target')); if (!target) return false;
    state.goals.push({ id: L.uid(), name, target, deadline: fd.get('d') || '', contributions: [] }); save(); render(); toast('Đã tạo mục tiêu');
  });
  wireMoney('target'); dlg.querySelector('#n').focus();
}
function contrib(id) {
  sheet('Góp tiền vào mục tiêu', money(), 'Góp tiền', (fd) => {
    const amount = need(fd.get('amount')); if (!amount) return false;
    state.goals.find((g) => g.id === id).contributions.push({ amount, date: L.todayStr() }); save(); render(); toast('Đã góp tiền');
  });
  wireMoney('amount').focus();
}

/* ---------- actions ---------- */
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
const actions = {
  add: () => addTx(), addcat: (id) => addTx(id), addbudget: () => addBudget(), 'addbudget-total': () => addBudget(true), addgoal: addGoal, contrib,
  mprev: () => { ui.month = L.shiftMonth(ui.month, -1); render(); },
  mnext: () => { ui.month = L.shiftMonth(ui.month, 1); render(); },
  deltx: (id) => { const i = state.transactions.findIndex((t) => t.id === id), [gone] = state.transactions.splice(i, 1); save(); render();
    toast('Đã xóa giao dịch', { label: 'Hoàn tác', run: () => { state.transactions.splice(i, 0, gone); save(); render(); } }); },
  editbudget: (id) => addBudget(state.budgets.find((b) => b.id === id)),
  contrib250: (id) => { state.goals.find((g) => g.id === id).contributions.push({ amount: 250000, date: L.todayStr() }); save(); render(); toast('Đã góp 250.000 ₫'); },
  delbudget: (id) => { const i = state.budgets.findIndex((b) => b.id === id), [gone] = state.budgets.splice(i, 1); save(); render();
    toast('Đã xóa ngân sách', { label: 'Hoàn tác', run: () => { state.budgets.splice(i, 0, gone); save(); render(); } }); },
  delgoal: (id) => { if (confirm('Xóa mục tiêu này cùng các khoản đã góp?')) { state.goals = state.goals.filter((g) => g.id !== id); save(); render(); } },
  logout: () => leave(),
  chpass: () => passwordSheet(),
  exportjson: () => download(`finmate-${L.todayStr()}.json`, JSON.stringify(state, null, 2), 'application/json'),
  exportcsv: () => download(`finmate-${L.todayStr()}.csv`, L.toCSV(state.transactions, state.categories), 'text/csv;charset=utf-8'),
  import: () => $('#file').click(),
  wipe: () => { if (confirm('Xóa TOÀN BỘ dữ liệu trên đám mây? Bạn không thể hoàn tác.')) { state = L.emptyState(); ui.recent = []; save(); render(); toast('Đã xóa toàn bộ dữ liệu'); } },
};
const go = (tab) => { ui.tab = tab; render(); window.scrollTo(0, 0); };
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]'); if (a) return actions[a.dataset.act]?.(a.dataset.id);
  const p = e.target.closest('[data-plan]'); if (p) { ui.plan = p.dataset.plan; return render(); }
  const g = e.target.closest('[data-tab-go]'); if (g) return go(g.dataset.tabGo);
  const t = e.target.closest('#nav [data-tab]'); if (t) go(t.dataset.tab);
});
$('#add').addEventListener('click', () => addTx());
document.addEventListener('input', (e) => { if (e.target.id !== 'q') return; ui.q = e.target.value; $('#txlist').innerHTML = txListHtml(); $('#qhint').textContent = ui.q.trim() ? 'Đang tìm trong tất cả các tháng.' : ''; });
for (const ev of ['pointerover', 'click']) document.addEventListener(ev, (e) => { const h = e.target.closest?.('[data-hit]'); if (h) setFlow(Number(h.dataset.hit)); });
$('#view').addEventListener('change', async (e) => {
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  try { const next = L.validateImport(JSON.parse(await e.target.files[0].text())); if (confirm('Thay dữ liệu hiện tại bằng file này?')) { state = next; save(); render(); toast('Đã khôi phục dữ liệu'); } }
  catch (err) { toast((err.message || 'File không hợp lệ') + '. Chọn file sao lưu FinMate (.json).'); }
});

/* ---------- cloud accounts & login screen ---------- */
const authEl = $('#auth');
const pw = (id, label, ac) =>
  `<label for="${id}">${label}</label><div class="pwrap"><input id="${id}" name="${id}" type="password" autocomplete="${ac}"><button type="button" class="eye" data-eye="${id}" aria-label="Hiện mật khẩu">Hiện</button></div>`;
const brand = '<svg viewBox="0 0 32 32" aria-hidden="true">' + document.querySelector('.nav .brand svg').innerHTML + '</svg>';
const googleIcon = '<svg width="18" height="18" viewBox="0 0 48 48" style="vertical-align:middle;margin-right:8px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

function showAuth(mode = 'login') {
  document.body.classList.add('locked');
  authEl.hidden = false;
  let body;

  if (mode === 'login') {
    body = `<h2>Đăng nhập</h2>
      <form id="loginform" novalidate>
        <label for="lemail">Email</label>
        <input id="lemail" name="lemail" type="email" autocomplete="email" placeholder="ban@example.com">
        ${pw('lpw', 'Mật khẩu', 'current-password')}
        <p class="err" id="autherr" role="alert"></p>
        <button class="btn primary block" type="submit">Đăng nhập</button>
      </form>
      <div style="margin:14px 0;text-align:center;color:var(--mute);font-size:.85rem">hoặc</div>
      <button type="button" class="btn block" id="google-btn" style="display:flex;align-items:center;justify-content:center">${googleIcon}Đăng nhập với Google</button>
      <div class="auth-links">
        <button class="linkbtn" data-auth="forgot">Quên mật khẩu?</button>
        <button class="linkbtn" data-auth="register">Tạo tài khoản mới</button>
      </div>`;
  } else if (mode === 'register') {
    body = `<h2>Tạo tài khoản đám mây</h2>
      <p class="sub">Đồng bộ thu chi và ngân sách trên mọi thiết bị của bạn.</p>
      <form id="regform" novalidate>
        <label for="rname">Tên hiển thị</label>
        <input id="rname" name="rname" maxlength="30" autocomplete="nickname" placeholder="VD: Linh">
        <label for="remail">Email</label>
        <input id="remail" name="remail" type="email" autocomplete="email" placeholder="ban@example.com">
        ${pw('rpw', `Mật khẩu (ít nhất ${MIN_PASSWORD} ký tự)`, 'new-password')}
        ${pw('rpw2', 'Nhập lại mật khẩu', 'new-password')}
        ${cloudAuth.hasLegacyData() ? '<label class="check"><input type="checkbox" id="keep" checked> Tải dữ liệu cũ trên máy này lên đám mây</label>' : ''}
        <p class="err" id="autherr" role="alert"></p>
        <button class="btn primary block" type="submit">Tạo tài khoản</button>
      </form>
      <div class="auth-links"><button class="linkbtn" data-auth="login">Đã có tài khoản? Đăng nhập</button></div>`;
  } else {
    body = `<h2>Đặt lại mật khẩu</h2>
      <p class="sub">Nhập email đã đăng ký, FinMate sẽ gửi liên kết đặt lại mật khẩu cho bạn.</p>
      <form id="forgotform" novalidate>
        <label for="femail">Email</label>
        <input id="femail" name="femail" type="email" autocomplete="email" placeholder="ban@example.com">
        <p class="err" id="autherr" role="alert"></p>
        <button class="btn primary block" type="submit">Gửi liên kết khôi phục</button>
      </form>
      <div class="auth-links"><button class="linkbtn" data-auth="login">Quay lại đăng nhập</button></div>`;
  }

  authEl.innerHTML = `<div class="auth-box">
    <div class="auth-brand">${brand}<h1>FinMate</h1><p>Hiểu dòng tiền – Làm chủ tương lai.</p></div>
    <div class="auth-card">${body}</div>
    <p class="auth-note">Dữ liệu được lưu trữ an toàn trên đám mây và đồng bộ tự động.</p>
  </div>`;
  authEl.querySelector('input:not([type=checkbox])')?.focus({ preventScroll: true });
}

async function enter(acc, initialLegacyState = null) {
  account = acc;
  ui = { tab: 'home', plan: 'budget', q: '', month: thisMonth(), recent: [], entered: false, syncStatus: 'syncing' };

  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey()));
    if (cached?.state) {
      state = L.validateImport(cached.state);
      ui.recent = cached.recent || [];
    }
  } catch {}

  authEl.hidden = true;
  authEl.innerHTML = '';
  document.body.classList.remove('locked');
  render();
  window.scrollTo(0, 0);

  try {
    if (initialLegacyState) {
      state = initialLegacyState;
      await cloudAuth.saveState(acc.id, state, ui.recent);
      localStorage.removeItem('finmate:v1');
      localStorage.removeItem('finmate:recent');
      toast('Đã chuyển dữ liệu lên đám mây');
    } else {
      const cloud = await cloudAuth.loadState(acc.id, L.emptyState);
      state = L.validateImport(cloud.state);
      ui.recent = cloud.recent;
      localStorage.setItem(cacheKey(), JSON.stringify({ state, recent: ui.recent }));
    }
    ui.syncStatus = 'synced';
    render();
  } catch (e) {
    console.warn('Initial cloud load failed', e);
    ui.syncStatus = 'offline';
    render();
    toast('Đang dùng dữ liệu ngoại tuyến.');
  }
}

async function leave() {
  await cloudAuth.logout();
  account = null;
  state = L.emptyState();
  if (dlg.open) dlg.close();
  $('#toast').hidden = true;
  $('#view').innerHTML = '';
  $('#bar').innerHTML = '';
  showAuth('login');
}

function passwordSheet() {
  sheet('Đổi mật khẩu', `${pw('np', `Mật khẩu mới (ít nhất ${MIN_PASSWORD} ký tự)`, 'new-password')}${pw('np2', 'Nhập lại mật khẩu mới', 'new-password')}<p class="err" id="sheeterr" role="alert"></p>`, 'Đổi mật khẩu', (fd) => {
    const err = $('#sheeterr'), n = fd.get('np');
    err.textContent = '';
    if (n !== fd.get('np2')) { err.textContent = 'Hai mật khẩu mới chưa giống nhau.'; return false; }
    cloudAuth.changePassword(n).then(() => { dlg.close(); toast('Đã đổi mật khẩu'); }).catch((e) => { err.textContent = e.message; });
    return false;
  });
}

authEl.addEventListener('click', async (e) => {
  const eye = e.target.closest('[data-eye]');
  if (eye) {
    const i = authEl.querySelector('#' + eye.dataset.eye);
    i.type = i.type === 'password' ? 'text' : 'password';
    eye.textContent = i.type === 'password' ? 'Hiện' : 'Ẩn';
    return;
  }
  if (e.target.closest('#google-btn')) {
    try {
      await cloudAuth.loginWithGoogle();
    } catch (x) {
      $('#autherr').textContent = x.message;
    }
    return;
  }
  const m = e.target.closest('[data-auth]');
  if (m) showAuth(m.dataset.auth);
});

authEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#autherr'), btn = e.target.querySelector('button[type=submit]');
  err.textContent = '';
  btn.disabled = true;

  try {
    if (e.target.id === 'loginform') {
      const acc = await cloudAuth.login($('#lemail').value, $('#lpw').value);
      await enter(acc);
    } else if (e.target.id === 'regform') {
      const name = $('#rname').value, email = $('#remail').value, pw1 = $('#rpw').value, pw2 = $('#rpw2').value;
      const msg = validateNewAccount(name, email, pw1, pw2);
      if (msg) throw new Error(msg);

      let legacy = null;
      if ($('#keep')?.checked && cloudAuth.hasLegacyData()) {
        try { legacy = L.validateImport(JSON.parse(localStorage.getItem('finmate:v1'))); } catch {}
      }
      const acc = await cloudAuth.register({ name, email, password: pw1 });
      await enter(acc, legacy);
    } else if (e.target.id === 'forgotform') {
      await cloudAuth.resetPassword($('#femail').value);
      toast('Đã gửi email đặt lại mật khẩu!');
      showAuth('login');
    }
  } catch (x) {
    err.textContent = x.message;
    btn.disabled = false;
  }
});

async function boot() {
  const acc = await cloudAuth.currentUser();
  if (acc) await enter(acc);
  else showAuth('login');
}
boot();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
