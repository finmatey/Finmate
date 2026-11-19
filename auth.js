// auth.js — Cloud authentication & state persistence via Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://bspfsnmvwvywuvdaezyl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kVw-7W6li686jrla4EzYsA_xR1gy79B';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const MIN_PASSWORD = 6;
const LEGACY = 'finmate:v1';

export function validateNewAccount(name, email, password, confirm) {
  if (!name.trim()) return 'Nhập tên hiển thị.';
  if (name.trim().length > 30) return 'Tên hiển thị tối đa 30 ký tự.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email chưa hợp lệ.';
  if (password.length < MIN_PASSWORD) return `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`;
  if (confirm !== undefined && password !== confirm) return 'Hai mật khẩu chưa giống nhau.';
  return '';
}

export const cloudAuth = {
  hasLegacyData: () => Boolean(localStorage.getItem(LEGACY)),

  async currentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const u = session.user;
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.user_metadata?.full_name || u.email.split('@')[0],
    };
  },

  async register({ name, email, password }) {
    const err = validateNewAccount(name, email, password);
    if (err) throw new Error(err);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) throw new Error(mapAuthError(error.message));
    if (!data.user) throw new Error('Không thể tạo tài khoản.');

    return { id: data.user.id, email: data.user.email, name: name.trim() };
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(mapAuthError(error.message));
    const u = data.user;
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.user_metadata?.full_name || u.email.split('@')[0],
    };
  },

  async loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://finmatey.github.io/Finmate/',
    },
  });

  if (error) throw new Error(mapAuthError(error.message));
},
  async logout() {
    await supabase.auth.signOut();
  },

  async resetPassword(email) {
    if (!email.trim()) throw new Error('Nhập email để nhận liên kết đặt lại mật khẩu.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw new Error(mapAuthError(error.message));
  },

  async changePassword(newPassword) {
    if (newPassword.length < MIN_PASSWORD) {
      throw new Error(`Mật khẩu mới cần ít nhất ${MIN_PASSWORD} ký tự.`);
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(mapAuthError(error.message));
  },

  async loadState(userId, fallbackFn) {
    const { data, error } = await supabase
      .from('finmate_states')
      .select('state, recent')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { state: fallbackFn(), recent: [] };
    return { state: data.state, recent: data.recent || [] };
  },

  async saveState(userId, state, recent) {
    const { error } = await supabase
      .from('finmate_states')
      .upsert({
        user_id: userId,
        state,
        recent,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  },
};

function mapAuthError(msg) {
  if (/invalid login/i.test(msg)) return 'Email hoặc mật khẩu chưa đúng.';
  if (/already registered/i.test(msg)) return 'Email này đã được đăng ký.';
  if (/rate limit/i.test(msg)) return 'Thao tác quá nhanh. Vui lòng thử lại sau.';
  return msg;
}
