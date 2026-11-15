// No provider call: same-origin no-charge preflight, kept only in component state.
export async function checkStructuredPreflight(prepared,{fetchImpl=fetch}={}){
 const form=new FormData();
 for(const [key,value]of Object.entries({mode:'condition-preflight',cardType:prepared.category,validationMechanism:'json_schema',validationManifest:prepared.manifest,validationCategorySelected:prepared.category,validationCategoryConfirmed:prepared.confirmedCategory,validationCategoryAttempt:prepared.confirmationAttemptId}))form.append(key,value);
 form.append('image',prepared.front);form.append('backImage',prepared.back);
 const r=await fetchImpl('/api/predict',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',body:form});
 if(!r.ok)throw Error('No-charge preflight rejected. Refresh owner authorization and prepare the pair again. No paid scan was requested.');
 const p=await r.json();
 if(p?.version!==1||p.mechanism!=='json_schema'||p.category!=='sports'||p.revision!==JSON.parse(prepared.manifest).revision||p.preparedPairVerified!==true||p.model!=='claude-sonnet-4-6'||p.schemaVersion!==1)throw Error('Preflight response mismatched. Stop; no paid scan was requested.');
 return p;
}
