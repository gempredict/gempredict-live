const callbackFields = [
  'type', 'access_token', 'refresh_token', 'expires_at', 'expires_in', 'token_type',
  'provider_token', 'provider_refresh_token', 'token_hash', 'code', 'error', 'error_code', 'error_description',
];
const expiryCodes = new Set(['otp_expired', 'flow_state_expired', 'session_expired', 'refresh_token_already_used']);

export function recoveryFailure(error, fallback = 'invalid') {
  if (expiryCodes.has(error?.code)) return 'expired';
  if (['session_not_found', 'refresh_token_not_found', 'bad_jwt'].includes(error?.code) || error?.status === 401) return 'invalid';
  if (error?.code === 'weak_password' || error?.code === 'same_password') return 'password_rejected';
  return Number(error?.status) >= 500 || error?.name === 'AuthRetryableFetchError' ? 'unavailable' : fallback;
}

// Called once at startup. The caller replaces the URL before any async work.
export function readLibraryRecovery(href, now = Date.now()) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const query = url.searchParams;
  const get = key => fragment.get(key) ?? query.get(key);
  const type = get('type');
  const errorCode = get('error_code');
  if (type !== 'recovery' && !expiryCodes.has(errorCode) && !errorCode && get('error') !== 'access_denied' && !['code', 'access_token', 'refresh_token', 'token_hash'].some(key => get(key))) return null;

  let callback;
  if (get('error') || errorCode) callback = { failure: recoveryFailure({ code: errorCode }) };
  else if (get('expires_at') && Number(get('expires_at')) * 1000 <= now) callback = { failure: 'expired' };
  else if (type === 'recovery' && get('access_token') && get('refresh_token')) {
    callback = { accessToken: get('access_token'), refreshToken: get('refresh_token') };
  } else if (type === 'recovery' && get('token_hash')) callback = { tokenHash: get('token_hash') };
  else if (get('code')) callback = { code: get('code') };
  else callback = { failure: 'invalid' };

  const isCallbackHash = callbackFields.some(key => fragment.has(key));
  for (const field of callbackFields) {
    query.delete(field);
    fragment.delete(field);
  }
  if (isCallbackHash) url.hash = fragment.toString();
  return { callback, cleanUrl: url.pathname + url.search + url.hash };
}

export async function openLibraryRecovery(auth, callback) {
  if (callback.failure) return callback.failure;
  try {
    const result = callback.tokenHash ? await auth.verifyOtp({ token_hash: callback.tokenHash, type: 'recovery' })
      : callback.code ? await auth.exchangeCodeForSession(callback.code)
        : await auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
    return result.error ? recoveryFailure(result.error) : result.data?.session ? 'ready' : 'invalid';
  } catch { return 'unavailable'; }
}

export async function saveLibraryPassword(auth, password, confirmation) {
  if (password !== confirmation) return 'mismatch';
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) return 'password_length';
  try {
    const { error } = await auth.updateUser({ password });
    if (error) return recoveryFailure(error, 'update_failed');
  } catch { return 'update_failed'; }
  try {
    // A recovery session is never promoted to a normal library session.
    const { error } = await auth.signOut({ scope: 'local' });
    return error ? 'updated_close_tab' : 'success';
  } catch { return 'updated_close_tab'; }
}
