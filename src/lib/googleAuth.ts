import supabase from './supabase';

const getAuthRedirectUrl = () => {
  const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL;
  const baseUrl = String(publicAppUrl || window.location.origin).replace(/\/$/, '');
  return `${baseUrl}/login`;
};

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl()
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
