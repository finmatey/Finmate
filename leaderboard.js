// leaderboard.js — server-ranked leaderboard UI + data layer. The browser never sends points or ranks:
// it only calls Supabase RPCs; the database decides what is awarded and how people rank.
import { supabase } from './auth.js';
import { PERIODS, SCOPES, PAGE_SIZE, BADGES, ERRORS, validateUsername, mapLbError, movementView, medal, esc } from './leaderboard-logic.js';

/* ---------- server calls (claims never carry a point value) ---------- */
async function rpc(name, args) { const { data, error } = await supabase.rpc(name, args); if (error) throw error; return data; }
const quiet = (p) => p.catch((e) => { console.warn('Leaderboard sync skipped', e?.message || e); return null; });
export const claimCheckin = () => quiet(rpc('claim_checkin'));
export const claimGoal = (goalId) => quiet(rpc('claim_goal', { p_goal_id: String(goalId) }));
export const claimBudgetWeek = () => quiet(rpc('claim_budget_week'));

/* ---------- UI ---------- */
const S = { period: 'weekly', scope: 'all', search: '', page: 0, rows: [], total: 0, me: null, summary: null, loading: false, error: '', editing: false, timer: null, poll: null, seq: 0 };
let root = null, onChange = () => {};

async function load() {
  const seq = ++S.seq; S.loading = true; S.error = ''; paint();
  try {
    const [rows, me, summary] = await Promise.all([
      rpc('get_leaderboard', { p_period: S.period, p_scope: S.scope, p_search: S.search, p_page: S.page, p_page_size: PAGE_SIZE }),
      rpc('get_my_rank', { p_period: S.period, p_scope: S.scope }),
      rpc('get_my_leaderboard_summary'),
    ]);
    if (seq !== S.seq) return; // a newer request superseded this one
    S.rows = rows || []; S.total = S.rows[0] ? Number(S.rows[0].total_count) : 0; S.me = me?.[0] || null; S.summary = summary;
  } catch (e) { if (seq !== S.seq) return; S.error = mapLbError(e); S.rows = []; S.total = 0; }
  S.loading = false; paint();
}

function paint() {
  if (!root || !root.isConnected) return;
  const hadFocus = document.activeElement?.id === 'lb-search';
  const sm = S.summary, joined = sm?.participate;
  const pages = Math.max(1, Math.ceil(S.total / PAGE_SIZE));
  const seg = (items, key, cur) => items.map(([v, l]) => `<button type="button" aria-pressed="${cur === v}" data-lb-${key}="${v}">${l}</button>`).join('');
  const rows = S.rows.map((r) => { const mv = movementView(r.movement); return `<li class="lb-row ${r.is_me ? 'me' : ''}"><span class="lb-rank">${medal(Number(r.rank)) || '#' + r.rank}</span><span class="lb-name">${esc(r.username)}${r.is_me ? ' <small>(Bạn)</small>' : ''}</span><span class="lb-mv ${mv.cls}" title="Thay đổi hạng so với kỳ trước">${mv.txt}</span><b class="num">${r.points}</b></li>`; }).join('');
  const empty = S.loading ? '' : S.error ? '' : `<p class="lb-empty">${S.search ? 'Không tìm thấy biệt danh nào.' : 'Chưa có ai có điểm trong kỳ này. Hãy điểm danh để mở đầu!'}</p>`;
  const meBox = S.me ? `<div class="lb-me"><span>Hạng của bạn</span><b>${medal(Number(S.me.rank)) || '#' + S.me.rank}</b><span>${S.me.points} điểm · ${S.me.participants} người</span><span class="lb-mv ${movementView(S.me.movement).cls}">${movementView(S.me.movement).txt}</span></div>`
    : `<div class="lb-me muted">${joined ? 'Bạn chưa có điểm trong kỳ này.' : 'Bật tham gia để xuất hiện trên bảng xếp hạng.'}</div>`;
  const badges = (sm?.badges || []).map((b) => BADGES[b] ? `<span class="lb-badge" title="${BADGES[b][1]}">${BADGES[b][0]} ${BADGES[b][1]}</span>` : '').join('');
  root.innerHTML = `<h2>🏆 Bảng xếp hạng FinPoints</h2>
    <p class="lb-note">Điểm do máy chủ xác minh từ thói quen thật (điểm danh, hoàn thành hũ, giữ ngân sách). Chỉ người đã bật tham gia mới hiển thị, bằng biệt danh.</p>
    <div class="lb-stats"><div><small>Tổng FinPoints xếp hạng</small><b class="num">${sm?.total_points ?? 0}</b></div><div><small>Chuỗi điểm danh</small><b class="num">🔥 ${sm?.streak ?? 0}</b></div></div>
    ${badges ? `<div class="lb-badges">${badges}</div>` : ''}
    ${S.editing || !sm?.has_profile ? profileForm(sm) : `<div class="lb-prof"><span>Biệt danh: <b>${esc(sm.username)}</b> · ${joined ? 'Đang tham gia' : 'Đang ẩn'}</span><button type="button" class="btn sm" data-lb-edit>Sửa hồ sơ</button></div>`}
    <div class="seg" role="group" aria-label="Kỳ xếp hạng">${seg(PERIODS, 'period', S.period)}</div>
    <div class="seg lb-scope" role="group" aria-label="Phạm vi">${seg(SCOPES, 'scope', S.scope)}</div>
    <input id="lb-search" type="search" maxlength="20" placeholder="Tìm biệt danh…" value="${esc(S.search)}" aria-label="Tìm biệt danh">
    ${meBox}
    ${S.error ? `<p class="lb-err" role="alert">${esc(S.error)} <button type="button" class="btn sm" data-lb-retry>Thử lại</button></p>` : ''}
    <ol class="lb-list ${S.loading ? 'loading' : ''}" aria-busy="${S.loading}">${rows}</ol>${S.loading && !S.rows.length ? '<p class="lb-empty">Đang tải…</p>' : empty}
    <div class="lb-pager"><button type="button" class="btn sm" data-lb-page="-1" ${S.page <= 0 || S.loading ? 'disabled' : ''}>‹ Trước</button><span>Trang ${S.page + 1}/${pages}</span><button type="button" class="btn sm" data-lb-page="1" ${S.page + 1 >= pages || S.loading ? 'disabled' : ''}>Sau ›</button></div>`;
  if (hadFocus) { const si = root.querySelector('#lb-search'); si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
}

function profileForm(sm) {
  return `<form class="lb-form" id="lb-form" novalidate><label for="lb-user">Biệt danh (không dùng tên thật)</label><input id="lb-user" maxlength="20" autocomplete="off" value="${esc(sm?.username || '')}" placeholder="vd: sao_mai_12">
    <label for="lb-school">Trường (tuỳ chọn, để xếp hạng theo trường)</label><input id="lb-school" maxlength="60" value="${esc(sm?.school || '')}">
    <label for="lb-class">Lớp (tuỳ chọn)</label><input id="lb-class" maxlength="10" value="${esc(sm?.class_name || '')}">
    <label class="check"><input type="checkbox" id="lb-part" ${sm?.participate ? 'checked' : ''}> Tham gia bảng xếp hạng công khai (chỉ hiện biệt danh và điểm)</label>
    <p class="lb-err" id="lb-ferr" role="alert"></p><button class="btn primary block" type="submit">Lưu hồ sơ xếp hạng</button></form>`;
}

async function saveProfile(form) {
  const v = (id) => form.querySelector(id).value, err = form.querySelector('#lb-ferr'), btn = form.querySelector('button[type=submit]');
  if (!validateUsername(v('#lb-user'))) { err.textContent = ERRORS.bad_username; return; }
  btn.disabled = true; err.textContent = '';
  try {
    await rpc('set_my_leaderboard_profile', { p_username: v('#lb-user'), p_participate: form.querySelector('#lb-part').checked, p_school: v('#lb-school'), p_class: v('#lb-class') });
    S.editing = false; S.page = 0; await load(); onChange();
  } catch (e) { err.textContent = mapLbError(e); btn.disabled = false; }
}

function bind() {
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lb-period],[data-lb-scope],[data-lb-page],[data-lb-edit],[data-lb-retry]'); if (!t) return;
    if (t.dataset.lbPeriod) { S.period = t.dataset.lbPeriod; S.page = 0; }
    else if (t.dataset.lbScope) { S.scope = t.dataset.lbScope; S.page = 0; }
    else if (t.dataset.lbPage) S.page = Math.max(0, S.page + Number(t.dataset.lbPage));
    else if (t.dataset.lbEdit !== undefined) { S.editing = true; return paint(); }
    load();
  });
  root.addEventListener('input', (e) => {
    if (e.target.id !== 'lb-search') return;
    clearTimeout(S.timer); S.timer = setTimeout(() => { S.search = e.target.value.trim().toLowerCase(); S.page = 0; load(); }, 300);
  });
  root.addEventListener('submit', (e) => { if (e.target.id === 'lb-form') { e.preventDefault(); saveProfile(e.target); } });
}

// Mount into a container; `claimToday` = user already checked in locally (idempotent retry of the server claim).
export function mountLeaderboard(el, { claimToday = false, onProfileSaved = () => {} } = {}) {
  root = el; onChange = onProfileSaved; clearInterval(S.poll); bind();
  (claimToday ? claimCheckin() : Promise.resolve()).then(() => load());
  S.poll = setInterval(() => { if (!root?.isConnected) return clearInterval(S.poll); if (!document.hidden && !S.loading) load(); }, 45000); // near-real-time refresh
}
export const refreshLeaderboard = () => { if (root?.isConnected) load(); };
export const resetLeaderboard = () => { clearInterval(S.poll); Object.assign(S, { rows: [], total: 0, me: null, summary: null, page: 0, search: '', editing: false }); root = null; };
