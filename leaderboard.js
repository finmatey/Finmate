// leaderboard.js — server-ranked leaderboard UI + data layer. The browser never sends points or ranks:
// it only calls Supabase RPCs; the database decides what is awarded and how people rank.
import { supabase } from './auth.js';
import { PERIODS, SCOPES, PAGE_SIZE, BADGES, ERRORS, validateUsername, mapLbError, movementView, medal, esc } from './leaderboard-logic.js';

export const LEADERBOARD_LOCKED = true; // Đổi thành false khi muốn mở khóa Bảng xếp hạng

/* ---------- server calls (claims never carry a point value) ---------- */
async function rpc(name, args) { const { data, error } = await supabase.rpc(name, args); if (error) throw error; return data; }
const REASONS = { no_budget: 'Hãy đặt ngân sách tổng cho tháng trước.', over_budget: 'Bạn đang vượt ngân sách tháng này.', log_more_days: 'Cần ghi chép giao dịch ít nhất 3 ngày trong 7 ngày gần nhất.', not_synced: 'Dữ liệu chưa đồng bộ lên đám mây, thử lại sau giây lát.', goal_not_synced: 'Dữ liệu chưa đồng bộ, thử lại sau giây lát.', goal_not_complete: 'Mục tiêu chưa hoàn thành.', monthly_cap: 'Đã đạt giới hạn 3 mục tiêu/tháng.' };
const quiet = (p) => p.catch((e) => { console.warn('Leaderboard sync skipped', e?.message || e); return null; });
export const claimCheckin = () => quiet(rpc('claim_checkin'));
export const claimGoal = (goalId) => quiet(rpc('claim_goal', { p_goal_id: String(goalId) }));
export const claimBudgetWeek = () => quiet(rpc('claim_budget_week'));
export const fetchSummary = () => quiet(rpc('get_my_leaderboard_summary'));

/* ---------- UI ---------- */
const S = { period: 'weekly', scope: 'all', search: '', page: 0, rows: [], total: 0, me: null, summary: null, defaults: { school: '', className: '' }, loading: false, error: '', editing: false, busy: false, timer: null, poll: null, seq: 0, uid: null };
let root = null, onChange = () => {}, hooks = { toast: () => {}, isSynced: () => true };

async function load() {
  const seq = ++S.seq; S.loading = true; S.error = ''; paint();
  if (LEADERBOARD_LOCKED) {
    try {
      const summary = await rpc('get_my_leaderboard_summary');
      if (seq !== S.seq) return;
      S.summary = summary;
    } catch (e) {
      if (seq !== S.seq) return;
      S.error = mapLbError(e);
    }
    S.rows = []; S.total = 0; S.me = null; S.loading = false; paint();
    return;
  }

  const [sumRes, boardRes] = await Promise.allSettled([
    rpc('get_my_leaderboard_summary'),
    Promise.all([
      rpc('get_leaderboard', { p_period: S.period, p_scope: S.scope, p_search: S.search, p_page: S.page, p_page_size: PAGE_SIZE }),
      rpc('get_my_rank', { p_period: S.period, p_scope: S.scope }),
    ]),
  ]);
  if (seq !== S.seq) return;
  if (sumRes.status === 'fulfilled') S.summary = sumRes.value;
  if (boardRes.status === 'fulfilled') {
    const [rows, me] = boardRes.value;
    S.rows = rows || [];
    S.total = S.rows[0] ? Number(S.rows[0].total_count) : 0;
    S.me = me?.[0] || null;
  } else {
    S.error = mapLbError(boardRes.reason);
    if (sumRes.status === 'rejected' && !S.error) S.error = mapLbError(sumRes.reason);
    S.rows = []; S.total = 0; S.me = null;
  }
  S.loading = false; paint();
}

function paint() {
  if (!root || !root.isConnected) return;
  const hadFocus = document.activeElement?.id === 'lb-search';
  const sm = S.summary, joined = sm?.participate;
  const pages = Math.max(1, Math.ceil(S.total / PAGE_SIZE));
  const seg = (items, key, cur) => items.map(([v, l]) => `<button type="button" aria-pressed="${cur === v}" data-lb-${key}="${v}">${l}</button>`).join('');
  const rows = S.rows.map((r) => { const mv = movementView(r.movement); return `<li class="lb-row ${r.is_me ? 'me' : ''}"><span class="lb-rank">${medal(Number(r.rank)) || '#' + r.rank}</span><span class="lb-name">${esc(r.username)}${r.is_me ? ' <small>(Bạn)</small>' : ''}</span><span class="lb-mv ${mv.cls}" title="Thay đổi hạng so với kỳ trước">${mv.txt}</span><b class="num">${r.points}</b></li>`; }).join('');
  const empty = S.loading || S.error ? '' : `<p class="lb-empty">${S.search ? 'Không tìm thấy biệt danh nào.' : 'Chưa có ai có điểm trong kỳ này. Hãy điểm danh để mở đầu!'}</p>`;
  const meBox = S.me ? `<div class="lb-me"><span>Hạng của bạn</span><b>${medal(Number(S.me.rank)) || '#' + S.me.rank}</b><span>${S.me.points} điểm · ${S.me.participants} người</span><span class="lb-mv ${movementView(S.me.movement).cls}">${movementView(S.me.movement).txt}</span></div>`
    : `<div class="lb-me muted">${joined ? 'Bạn chưa có điểm trong kỳ này.' : 'Bật tham gia để xuất hiện trên bảng xếp hạng.'}</div>`;
  const badges = (sm?.badges || []).map((b) => BADGES[b] ? `<span class="lb-badge" title="${BADGES[b][1]}">${BADGES[b][0]} ${BADGES[b][1]}</span>` : '').join('');

  const boardSection = LEADERBOARD_LOCKED
    ? `<div class="lb-locked" role="region" aria-label="Bảng xếp hạng đang bị khóa">
        <div class="lb-lock-ico" aria-hidden="true">🔒</div>
        <h3>Bảng xếp hạng đang bị khóa</h3>
        <p>Phần Leaderboards hiện đang tạm khóa. Điểm FinPoints, chuỗi điểm danh và huy hiệu của bạn vẫn được lấy trực tiếp từ Supabase.</p>
      </div>`
    : `${S.editing || !sm?.has_profile ? profileForm(sm) : `<div class="lb-prof"><span>Biệt danh: <b>${esc(sm.username)}</b> · ${joined ? 'Đang tham gia' : 'Đang ẩn'}</span><button type="button" class="btn sm" data-lb-edit>Sửa hồ sơ</button></div>`}
      <div class="seg" role="group" aria-label="Kỳ xếp hạng">${seg(PERIODS, 'period', S.period)}</div>
      <div class="seg lb-scope" role="group" aria-label="Phạm vi">${seg(SCOPES, 'scope', S.scope)}</div>
      <input id="lb-search" type="search" maxlength="20" placeholder="Tìm biệt danh…" value="${esc(S.search)}" aria-label="Tìm biệt danh">
      ${meBox}
      ${S.error ? `<p class="lb-err" role="alert">${esc(S.error)} <button type="button" class="btn sm" data-lb-retry>Thử lại</button></p>` : ''}
      <ol class="lb-list ${S.loading ? 'loading' : ''}" aria-busy="${S.loading}">${rows}</ol>${S.loading && !S.rows.length ? '<p class="lb-empty">Đang tải…</p>' : empty}
      <div class="lb-pager"><button type="button" class="btn sm" data-lb-page="-1" ${S.page <= 0 || S.loading ? 'disabled' : ''}>‹ Trước</button><span>Trang ${S.page + 1}/${pages}</span><button type="button" class="btn sm" data-lb-page="1" ${S.page + 1 >= pages || S.loading ? 'disabled' : ''}>Sau ›</button></div>`;

  root.innerHTML = `<h2>🏆 FinPoints & Bảng xếp hạng</h2>
    <p class="lb-note">Điểm do Supabase xác minh từ thói quen thật (điểm danh, hoàn thành hũ, giữ ngân sách).</p>
    <div class="lb-stats"><div><small>Tổng FinPoints từ Supabase</small><b class="num">${sm?.total_points ?? 0}</b></div><div><small>Chuỗi điểm danh</small><b class="num">🔥 ${sm?.streak ?? 0}</b></div></div>
    ${badges ? `<div class="lb-badges">${badges}</div>` : ''}
    <div class="lb-earn"><button type="button" class="btn ${sm?.checked_in_today ? '' : 'primary'}" data-lb-checkin ${sm?.checked_in_today || S.busy ? 'disabled' : ''}>${sm?.checked_in_today ? 'Đã điểm danh hôm nay' : 'Điểm danh +15 FinPoints'}</button>
      <button type="button" class="btn" data-lb-week ${sm?.week_claimed || S.busy ? 'disabled' : ''}>${sm?.week_claimed ? 'Đã nhận thưởng tuần' : 'Thưởng giữ ngân sách +50'}</button></div>
    ${LEADERBOARD_LOCKED && S.error ? `<p class="lb-err" role="alert">${esc(S.error)} <button type="button" class="btn sm" data-lb-retry>Thử lại</button></p>` : ''}
    ${boardSection}`;
  if (hadFocus) { const si = root.querySelector('#lb-search'); if (si) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); } }
}

function profileForm(sm) {
  const schoolVal = sm?.school || S.defaults.school || '';
  const classVal = sm?.class_name || S.defaults.className || '';
  return `<form class="lb-form" id="lb-form" novalidate><label for="lb-user">Biệt danh (không dùng tên thật)</label><input id="lb-user" maxlength="20" autocomplete="off" value="${esc(sm?.username || '')}" placeholder="nhap_biet_danh">
    <label for="lb-school">Trường (tuỳ chọn, để xếp hạng theo trường)</label><input id="lb-school" maxlength="60" value="${esc(schoolVal)}">
    <label for="lb-class">Lớp (tuỳ chọn)</label><input id="lb-class" maxlength="10" value="${esc(classVal)}">
    <label class="check"><input type="checkbox" id="lb-part" ${sm?.participate ? 'checked' : ''}> Tham gia bảng xếp hạng công khai (chỉ hiện biệt danh và điểm)</label>
    <p class="lb-err" id="lb-ferr" role="alert"></p><button class="btn primary block" type="submit">Lưu hồ sơ xếp hạng</button></form>`;
}

async function saveProfile(form) {
  const v = (id) => form.querySelector(id).value, err = form.querySelector('#lb-ferr'), btn = form.querySelector('button[type=submit]');
  if (!validateUsername(v('#lb-user'))) { err.textContent = ERRORS.bad_username; return; }
  btn.disabled = true; err.textContent = '';
  try {
    await rpc('set_my_leaderboard_profile', { p_username: v('#lb-user').trim().toLowerCase(), p_participate: form.querySelector('#lb-part').checked, p_school: v('#lb-school'), p_class: v('#lb-class') });
    S.editing = false; S.page = 0; await load(); onChange();
  } catch (e) { err.textContent = mapLbError(e); btn.disabled = false; }
}

async function earn(kind) {
  if (kind === 'week' && !hooks.isSynced()) return hooks.toast('Đang đồng bộ dữ liệu, thử lại sau giây lát.');
  S.busy = true; paint();
  try {
    const r = await rpc(kind === 'week' ? 'claim_budget_week' : 'claim_checkin');
    hooks.toast(r?.awarded ? `+${r.points} FinPoints!` : REASONS[r?.reason] || 'Bạn đã nhận rồi.');
  } catch (e) { hooks.toast(mapLbError(e)); }
  S.busy = false; await load();
}

function bind(el) {
  if (el.dataset.lbBound === '1') return;
  el.dataset.lbBound = '1';
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lb-period],[data-lb-scope],[data-lb-page],[data-lb-edit],[data-lb-retry],[data-lb-checkin],[data-lb-week]'); if (!t) return;
    if (t.dataset.lbCheckin !== undefined) return earn('checkin');
    if (t.dataset.lbWeek !== undefined) return earn('week');
    if (t.dataset.lbPeriod) { S.period = t.dataset.lbPeriod; S.page = 0; }
    else if (t.dataset.lbScope) { S.scope = t.dataset.lbScope; S.page = 0; }
    else if (t.dataset.lbPage) S.page = Math.max(0, S.page + Number(t.dataset.lbPage));
    else if (t.dataset.lbEdit !== undefined) { S.editing = true; return paint(); }
    load();
  });
  el.addEventListener('input', (e) => {
    if (e.target.id !== 'lb-search') return;
    clearTimeout(S.timer); S.timer = setTimeout(() => { S.search = e.target.value.trim().toLowerCase(); S.page = 0; load(); }, 300);
  });
  el.addEventListener('submit', (e) => { if (e.target.id === 'lb-form') { e.preventDefault(); saveProfile(e.target); } });
}

// Mount into a container. State is cleared automatically when a different account mounts it.
export function mountLeaderboard(el, { userId = null, defaults = {}, onProfileSaved = () => {}, toast = () => {}, isSynced = () => true } = {}) {
  if (S.uid !== userId) { resetLeaderboard(); S.uid = userId; }
  S.defaults = { school: defaults.school || '', className: defaults.className || '' };
  root = el; onChange = onProfileSaved; hooks = { toast, isSynced }; clearInterval(S.poll); bind(el);
  load();
  S.poll = setInterval(() => { if (!root?.isConnected) return clearInterval(S.poll); if (!document.hidden && !S.loading) load(); }, 45000);
}
export const refreshLeaderboard = () => { if (root?.isConnected) load(); };
export const resetLeaderboard = () => { clearInterval(S.poll); Object.assign(S, { rows: [], total: 0, me: null, summary: null, page: 0, search: '', editing: false, busy: false, error: '', uid: null }); root = null; };