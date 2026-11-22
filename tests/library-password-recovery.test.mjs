import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { mountLibrary } from './helpers/renderReports.mjs';
import { openLibraryRecovery, readLibraryRecovery, saveLibraryPassword } from '../lib/libraryPasswordRecovery.mjs';

const origin='https://library-preview.example';
const link=origin+'/?source=email#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function findForm(tree, fieldName) {
  if (!tree || typeof tree !== 'object') return null;
  if (Array.isArray(tree)) return tree.map(child=>findForm(child,fieldName)).find(Boolean) || null;
  if (tree.type==='form'&&hasInput(tree,fieldName)) return tree;
  return findForm(tree.props?.children,fieldName);
}
function hasInput(tree, name) {
  if (!tree || typeof tree !== 'object') return false;
  if (Array.isArray(tree)) return tree.some(child=>hasInput(child,name));
  return tree.type==='input'&&tree.props.name===name || hasInput(tree.props?.children,name);
}
function submit(form, fields) {
  assert.ok(form);
  return form.props.onSubmit({ preventDefault(){}, currentTarget:{fields,reset(){}} });
}

test('recovery callback removes all auth fields while preserving normal URL metadata',()=>{
 const recovery=readLibraryRecovery(link);
 assert.deepEqual(recovery,{callback:{accessToken:'synthetic-access',refreshToken:'synthetic-refresh'},cleanUrl:'/?source=email'});
 assert.equal(readLibraryRecovery(origin+'/?source=email#library'),null);
 assert.deepEqual(readLibraryRecovery(origin+'/?type=recovery&token_hash=synthetic&source=email#library'),
  {callback:{tokenHash:'synthetic'},cleanUrl:'/?source=email#library'});
 assert.deepEqual(readLibraryRecovery(origin+'/#access_token=synthetic'),{callback:{failure:'invalid'},cleanUrl:'/'});
 assert.equal(readLibraryRecovery(origin+'/#error=access_denied&error_code=otp_expired&error_description=private').callback.failure,'expired');
 assert.equal(readLibraryRecovery(origin+'/#type=recovery').callback.failure,'invalid');
 assert.equal(readLibraryRecovery(link+'&expires_at=1',1000).callback.failure,'expired');
});

test('token-hash and PKCE callbacks defer validation to Supabase and report safe failures',async()=>{
 const calls=[];
 const auth={
  async verifyOtp(body){calls.push(body);return {data:{session:{}}};},
  async exchangeCodeForSession(code){calls.push(code);return {error:{code:'flow_state_expired',message:'private'}};},
 };
 assert.equal(await openLibraryRecovery(auth,{tokenHash:'mock-hash'}),'ready');
 assert.equal(await openLibraryRecovery(auth,{code:'mock-code'}),'expired');
 assert.deepEqual(calls,[{token_hash:'mock-hash',type:'recovery'},'mock-code']);
 assert.equal(await openLibraryRecovery({}, {failure:'invalid'}),'invalid');
});

test('password change requires confirmation, bounds length and closes the recovery session',async()=>{
 const calls=[];
 const auth={
  async updateUser(body){calls.push(body);return {error:null};},
  async signOut(options){calls.push(options);return {error:null};},
 };
 assert.equal(await saveLibraryPassword(auth,'Example-password','mismatch'),'mismatch');
 assert.equal(await saveLibraryPassword(auth,'short','short'),'password_length');
 assert.equal(await saveLibraryPassword(auth,'é'.repeat(37),'é'.repeat(37)),'password_length');
 assert.deepEqual(calls,[]);
 assert.equal(await saveLibraryPassword(auth,'Example-password','Example-password'),'success');
 assert.deepEqual(calls,[{password:'Example-password'},{scope:'local'}]);
 assert.equal(await saveLibraryPassword({async updateUser(){return {error:{code:'weak_password',message:'private'}};}},'Example-password','Example-password'),'password_rejected');
 assert.equal(await saveLibraryPassword({...auth,async signOut(){return {error:{message:'private'}};}},'Example-password','Example-password'),'updated_close_tab');
});

function fixture(href) {
 let notify;
 const events=[],requests=[],passwords=[];
 const recovery={user:{id:'owner'},access_token:'recovery-token'};
 const normal={user:{id:'owner'},access_token:'normal-token'};
 const auth={
  onAuthStateChange(callback){notify=callback;notify('INITIAL_SESSION',null);return {data:{subscription:{unsubscribe(){}}}};},
  async stopAutoRefresh(){},
  async setSession(input){
   assert.deepEqual(input,{access_token:'synthetic-access',refresh_token:'synthetic-refresh'});
   notify('SIGNED_IN',recovery);notify('PASSWORD_RECOVERY',recovery);notify('TOKEN_REFRESHED',recovery);
   return {data:{session:recovery}};
  },
  async updateUser({password}){passwords.push(password);notify('USER_UPDATED',recovery);return {error:null};},
  async signOut(){notify('SIGNED_OUT',null);return {error:null};},
  async signInWithPassword({email,password}){
   assert.equal(email,'owner@example.test');assert.equal(password,'Example-password');
   notify('SIGNED_IN',normal);return {error:null};
  },
 };
 const view=mountLibrary({href,auth,onSession:token=>events.push(token),fetch:async url=>{
  requests.push(url);
  return Response.json({url:origin,publishableKey:'sb_publishable_synthetic'});
 }});
 return {view,events,requests,passwords,recovery,notify:(...args)=>notify(...args)};
}

test('recovery locks out login and reports despite subsequent Auth events',async()=>{
 const f=fixture(link);
 await flush();
 assert.deepEqual(f.view.navigations,['/?source=email']);
 const view=f.view.render();
 const form=findForm(view,'confirmation');
 assert.ok(form);
 assert.equal(findForm(view,'email'),null);
 assert.doesNotMatch(renderToStaticMarkup(view),/Search cards|synthetic-access|recovery-token/);
 await submit(form,{password:'Example-password',confirmation:'mismatch'});
 assert.match(renderToStaticMarkup(f.view.render()),/passwords do not match/);
 assert.deepEqual(f.passwords,[]);
 await submit(findForm(f.view.render(),'confirmation'),{password:'Example-password',confirmation:'Example-password'});
 assert.match(renderToStaticMarkup(f.view.render()),/password was updated/);
 assert.ok(f.events.every(token=>token===null));
 assert.deepEqual(f.requests,['/api/saved-reports?config=1']);
 f.view.close();
});

test('normal password login remains available and PASSWORD_RECOVERY immediately hides it',async()=>{
 const f=fixture(origin+'/');
 await flush();
 await submit(findForm(f.view.render(),'email'),{email:'owner@example.test',password:'Example-password'});
 assert.ok(f.events.includes('normal-token'));
 assert.match(renderToStaticMarkup(f.view.render()),/Search cards/);
 f.notify('PASSWORD_RECOVERY',f.recovery);
 f.notify('SIGNED_IN',f.recovery);
 const html=renderToStaticMarkup(f.view.render());
 assert.match(html,/Set new password/);
 assert.doesNotMatch(html,/Search cards/);
 assert.equal(f.events.at(-1),null);
 assert.ok(!f.events.includes('recovery-token'));
 f.view.close();
});

test('expired and invalid links show a fixed safe message without exposing callback details',async()=>{
 for(const [hash,message] of [
  ['#error=access_denied&error_code=otp_expired&error_description=private-marker',/reset link has expired/],
  ['#type=recovery&access_token=private-marker',/reset link is invalid/],
 ]) {
  const f=fixture(origin+'/'+hash);
  await flush();
  const html=renderToStaticMarkup(f.view.render());
  assert.match(html,message);
  assert.doesNotMatch(html,/private-marker|Search cards/);
  assert.equal(findForm(f.view.render(),'email'),null);
  f.view.close();
 }
});
