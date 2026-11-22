import { openLibraryRecovery, readLibraryRecovery, saveLibraryPassword } from '../../lib/libraryPasswordRecovery.mjs';
import { useEffect, useRef, useState } from 'react';

const recoveryMessages = {
  loading: 'Checking your password reset link…',
  expired: 'This password reset link has expired. Request a new link.',
  invalid: 'This password reset link is invalid or has already been used. Request a new link.',
  unavailable: 'Password recovery is temporarily unavailable. Try a new password reset link later.',
  success: 'Your password was updated. Sign in with your new password.',
  updated_close_tab: 'Your password was updated. Close this tab before signing in again.',
};
const passwordMessages = {
  mismatch: 'The passwords do not match.',
  password_length: 'Use at least 8 characters and at most 72 bytes.',
  password_rejected: 'Choose a different password that meets the account’s password policy.',
  update_failed: 'The password could not be updated. Try again.',
};

export default function MyCardLibrary({ onSession, revision, renderReport }) {
  const [client, setClient] = useState(null);
  const [available, setAvailable] = useState(null);
  const [session, setSession] = useState(null);
  const [reports, setReports] = useState([]);
  const [opened, setOpened] = useState(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [reload, setReload] = useState(0);
  const [listing, setListing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeOwner = useRef(null);
  const [recovery, setRecovery] = useState(null);
  const recoveryLock = useRef(false);
  const callbackRef = useRef(undefined);
  const recoveryHeading = useRef(null);
  const recoverySubmission = useRef(false);

  useEffect(() => {
    if (recovery) recoveryHeading.current?.focus();
  }, [recovery]);

  useEffect(() => {
    const controller = new AbortController();
    let subscription;
    let auth;
    if (callbackRef.current === undefined) {
      const incoming = readLibraryRecovery(window.location.href);
      callbackRef.current = incoming?.callback ?? null;
      if (incoming) {
        const state = window.history.state;
        // Next.js also keeps the current route in its history state.
        window.history.replaceState(state?.__N ? { ...state, as: incoming.cleanUrl, url: incoming.cleanUrl } : state,
          '', incoming.cleanUrl);
      }
    }
    if (callbackRef.current) {
      recoveryLock.current = true;
      setRecovery(callbackRef.current.failure || 'loading');
      onSession(null);
    }
    async function load() {
      try {
        const response = await fetch('/api/saved-reports?config=1', {
          cache: 'no-store', redirect: 'error', signal: controller.signal,
        });
        if (response.status === 404) {
          setAvailable(false);
          if (recoveryLock.current) {
            setRecovery(callbackRef.current?.failure || 'unavailable');
            callbackRef.current = null;
          }
          return;
        }
        if (!response.ok) throw Error();
        const { url, publishableKey } = await response.json();
        const { createClient } = await import('@supabase/supabase-js');
        if (controller.signal.aborted) return;
        auth = createClient(url, publishableKey, { auth: {
          persistSession: false, detectSessionInUrl: false, autoRefreshToken: true,
        } });
        subscription = auth.auth.onAuthStateChange((event, next) => {
          if (controller.signal.aborted) return;
          if (event === 'PASSWORD_RECOVERY') {
            recoveryLock.current = true;
            activeOwner.current = null;
            setReports([]); setOpened(null); setHasMore(false); setPage(0);
            setSession(null); onSession(null); setError('');
            // Manual URL handling reports its own outcome after the Auth call.
            if (!callbackRef.current) setRecovery(next ? 'ready' : 'invalid');
            return;
          }
          if (recoveryLock.current) return;
          const nextOwner = next?.user?.id || null;
          if (activeOwner.current !== nextOwner) {
            activeOwner.current = nextOwner;
            setReports([]); setOpened(null); setHasMore(false); setPage(0); setError(''); setBusy(false);
          }
          setSession(next);
          onSession(next?.access_token || null);
        }).data.subscription;
        setClient(auth);
        setAvailable(true);
        const callback = callbackRef.current;
        if (callback) {
          const status = await openLibraryRecovery(auth.auth, callback);
          if (!controller.signal.aborted) {
            callbackRef.current = null;
            setRecovery(status);
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setAvailable(false);
          if (recoveryLock.current) {
            setRecovery(callbackRef.current?.failure || 'unavailable');
            callbackRef.current = null;
          }
          else setError('My Card Library is temporarily unavailable.');
        }
      }
    }
    load();
    return () => { controller.abort(); subscription?.unsubscribe(); auth?.auth.stopAutoRefresh().catch(() => {}); };
  }, [onSession]);

  const token = recovery ? null : session?.access_token;
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setListing(true);
    setError('');
    const query = new URLSearchParams({ search, sort, page: String(page) });
    fetch('/api/saved-reports?' + query, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, redirect: 'error',
    }).then(async response => {
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!controller.signal.aborted) {
        setReports(data.reports); setHasMore(data.hasMore);
      }
    }).catch(() => {
      if (!controller.signal.aborted) { setReports([]); setHasMore(false); setError('Saved reports could not load. Try refreshing the library.'); }
    }).finally(() => {
      if (!controller.signal.aborted) setListing(false);
    });
    return () => controller.abort();
  }, [token, search, sort, page, reload, revision]);

  async function signIn(event) {
    event.preventDefault();
    setBusy(true); setError('');
    const form = event.currentTarget;
    const credentials = new FormData(form);
    form.reset();
    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(credentials.get('email')).trim(), password: String(credentials.get('password')),
      });
      if (error) throw Error();
    } catch { setError('Sign-in failed. Check your library account details.'); }
    finally { setBusy(false); }
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (recoverySubmission.current || recovery !== 'ready') return;
    recoverySubmission.current = true;
    setBusy(true); setError('');
    const form = event.currentTarget;
    const fields = new FormData(form);
    form.reset();
    try {
      const status = await saveLibraryPassword(client.auth, String(fields.get('password')), String(fields.get('confirmation')));
      if (passwordMessages[status]) setError(passwordMessages[status]);
      else setRecovery(status);
    } finally { recoverySubmission.current = false; setBusy(false); }
  }

  async function returnToSignIn() {
    // Clear any partially established session before allowing library access.
    if (client && recovery !== 'success') {
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw Error();
      } catch { setError('Close this tab and reopen My Card Library to sign in.'); return; }
    }
    callbackRef.current = null;
    setSession(null); onSession(null); setError('');
    recoveryLock.current = false;
    setRecovery(null);
  }

  async function readOrDelete(id, remove = false) {
    if (busy || !token || (remove && !window.confirm('Delete this saved report? This cannot be undone.'))) return;
    const owner = activeOwner.current;
    setBusy(true); setError('');
    try {
      const result = await fetch('/api/saved-reports?id=' + encodeURIComponent(id), {
        method: remove ? 'DELETE' : 'GET', headers: { Authorization: `Bearer ${token}` },
        redirect: 'error', signal: AbortSignal.timeout(8000),
      });
      if (!result.ok) throw Error(result.status === 422 ? 'unsupported_report_version' : 'unavailable');
      const data = await result.json();
      if (activeOwner.current !== owner) return;
      if (remove) {
        setOpened(previous => previous?.id === id ? null : previous);
        if (reports.length === 1 && page > 0) setPage(page - 1);
        setReload(previous => previous + 1);
      } else setOpened(data.report);
    } catch (failure) {
      if (activeOwner.current === owner) setError(failure.message === 'unsupported_report_version'
        ? 'This saved report uses a version this app cannot display.'
        : remove ? 'This report could not be deleted.' : 'This report could not be opened.');
    } finally { if (activeOwner.current === owner) setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setError('');
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw Error();
      setSession(null); onSession(null);
    } catch { setError('Sign-out failed. Try again.'); }
    finally { setBusy(false); }
  }

  if (!available && !error && !recovery) return null;
  const controls={ display:'flex', flexWrap:'wrap', alignItems:'end', gap:8 };
  const field={ display:'grid', flex:'1 1 150px', minWidth:0, gap:4 };
  const button={ minHeight:44 };
  return <section aria-label="My Card Library" style={{border:'1px solid #d9c6a7',borderRadius:12,padding:16,margin:'16px 0',minWidth:0,overflowWrap:'anywhere'}}>
    <h2>My Card Library</h2>
    {error&&<p role="alert">{error}</p>}
    {recovery&&<>
      <h3 ref={recoveryHeading} tabIndex={-1}>{recovery==='ready'?'Set new password':'Password reset'}</h3>
      {recoveryMessages[recovery]&&<p role={recovery==='success'||recovery==='loading'?'status':'alert'}>{recoveryMessages[recovery]}</p>}
      {recovery==='ready'&&<form method="post" onSubmit={updatePassword} style={controls}>
        <label style={field}>New password<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72}/></label>
        <label style={field}>Confirm new password<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={72}/></label>
        <button style={button} type="submit" disabled={busy}>Update password</button>
      </form>}
      {['invalid','expired','success','unavailable'].includes(recovery)&&<button style={button} type="button" onClick={returnToSignIn}>Return to sign in</button>}
    </>}
    {!recovery&&available&&!session&&<form method="post" onSubmit={signIn} style={controls}>
      <label style={field}>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>
      <label style={field}>Password<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>
      <button style={button} type="submit" disabled={busy}>Sign in</button>
      <p style={{flexBasis:'100%',margin:0}}>Sign in before Full Analysis to save completed reports automatically.</p>
    </form>}
    {!recovery&&session&&<>
      <form style={controls} onSubmit={event=>{event.preventDefault();setSearch(draft);setPage(0);}}>
        <label style={field}>Search cards<input value={draft} maxLength={80} onChange={event=>setDraft(event.target.value)}/></label>
        <button style={button} type="submit">Search</button>
        <label style={field}>Sort<select value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Card name</option>
        </select></label>
        <button style={button} type="button" onClick={()=>setReload(value=>value+1)}>Refresh</button>
        <button style={button} type="button" disabled={busy} onClick={signOut}>Sign out</button>
      </form>
      {listing?<p role="status">Loading saved reports…</p>:!error&&!reports.length?<p>{search?'No reports match this search.':'No saved reports yet.'}</p>:null}
      {!listing&&reports.length>0&&<ul style={{padding:0,listStyle:'none'}}>
        {reports.map(report=><li key={report.id} style={{borderTop:'1px solid #ddd',padding:'10px 0',display:'grid',gap:4}}>
          <strong>{report.card_name}</strong>
          <span>{report.card_number?'#'+report.card_number+' · ':''}<time dateTime={report.created_at}>{new Date(report.created_at).toLocaleDateString()}</time></span>
          <div style={controls}>
            <button style={button} type="button" disabled={busy} onClick={()=>readOrDelete(report.id)}>Open saved report</button>
            <button style={button} type="button" disabled={busy} onClick={()=>readOrDelete(report.id,true)}>Delete saved report</button>
          </div>
        </li>)}
      </ul>}
      {(page>0||hasMore)&&<div style={controls}>
        <button style={button} type="button" disabled={listing||page===0} onClick={()=>setPage(value=>value-1)}>Previous</button>
        <button style={button} type="button" disabled={listing||!hasMore} onClick={()=>setPage(value=>value+1)}>Next</button>
      </div>}
      {opened&&<div style={{marginTop:16}}>
        <p>Saved report · {opened.model} · Version {opened.schema_version}</p>
        <button style={button} type="button" onClick={()=>setOpened(null)}>Close saved report</button>
        {renderReport(opened.payload)}
      </div>}
    </>}
  </section>;
}
