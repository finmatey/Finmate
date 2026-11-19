# FinMate Cloud Setup Guide

## 1. Create Supabase Project
1. Sign up at https://supabase.com and create a new project.
2. Open **SQL Editor** and run `supabase-schema.sql` to create the `finmate_states` table and Row-Level Security policies.
3. Go to **Project Settings -> API** and copy your **Project URL** and **anon public** key.
4. Paste them into the top of `auth.js`:
   ```js
   const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
   ```

## 2. Enable Auth Providers
- **Email/Password:** Enabled by default under *Authentication -> Providers -> Email*. (Optional: turn off "Confirm email" for instant registration during testing.)
- **Google Sign-In:** Enable under *Authentication -> Providers -> Google*, paste your Google OAuth Client ID & Secret, and add your site URL to *Authentication -> URL Configuration -> Redirect URLs*.
