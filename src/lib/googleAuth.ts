import supabase from './supabase';

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/login`
    }
  });

  if (error) {
    console.error('[google-auth] signInWithOAuth failed:', error.message);
    return;
  }

  // Supabase may return a URL when skipBrowserRedirect is used; keep for safety.
  if (data?.url) {
    window.location.assign(data.url);
  }
}

export function handleGoogleRedirect() {
  // Supabase JS auto-detects OAuth sessions in URL by default.
}
