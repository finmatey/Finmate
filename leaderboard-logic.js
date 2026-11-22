// leaderboard-logic.js — pure helpers (no network imports) so they can be unit-tested offline.
export const PERIODS = [['daily', 'Hôm nay'], ['weekly', 'Tuần'], ['monthly', 'Tháng'], ['alltime', 'Tất cả']];
export const SCOPES = [['all', 'Tất cả'], ['school', 'Trường'], ['class', 'Lớp']];
export const PAGE_SIZE = 20;
export const BADGES = {
  first_checkin: ['🌱', 'Điểm danh đầu tiên'], streak_7: ['🔥', 'Chuỗi 7 ngày'], streak_30: ['⚡', 'Chuỗi 30 ngày'],
  points_100: ['🥉', '100 điểm'], points_500: ['🥈', '500 điểm'], points_1000: ['🥇', '1000 điểm'],
  goal_1: ['🎯', 'Hoàn thành hũ tiết kiệm'], budget_1: ['🧾', 'Giữ vững ngân sách tuần'],
};
export const ERRORS = {
  bad_username: 'Biệt danh gồm 3–20 ký tự: chữ thường, số hoặc dấu gạch dưới.',
  username_taken: 'Biệt danh này đã có người dùng.',
  set_school_first: 'Hãy nhập trường (và lớp) trong hồ sơ xếp hạng để dùng bộ lọc này.',
  not_authenticated: 'Vui lòng đăng nhập lại.',
};

export const validateUsername = (u) => /^[a-z0-9_]{3,20}$/.test(String(u || '').trim().toLowerCase());
export const mapLbError = (e) => { const m = String(e?.message || e || ''); const k = Object.keys(ERRORS).find((x) => m.includes(x)); return k ? ERRORS[k] : 'Không tải được bảng xếp hạng. Thử lại sau.'; };
export const movementView = (m) => (m == null ? { cls: 'new', txt: 'Mới' } : m > 0 ? { cls: 'up', txt: `▲${m}` } : m < 0 ? { cls: 'down', txt: `▼${-m}` } : { cls: 'same', txt: '–' });
export const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


