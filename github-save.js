(()=>{
'use strict';
const OWNER='kingcheesezombie',REPO='OneVision.Architecture',BRANCH='main';
const ROOT='https://api.github.com/repos/'+OWNER+'/'+REPO;
const ALLOWED=new Set(['meta.yaml','applications.yaml','capabilities.yaml','sources.yaml','workflows.yaml','endpoints.yaml']);
function assert(v,message){if(!v)throw Error(message)}
function decodeBase64(value){
 const binary=atob(value.replace(/\s/g,''));
 return new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
}
class OneVisionGitHubSave{
 constructor(){this.token=null;this.login=null}
 connected(){return !!this.token}
 disconnect(){this.token=null;this.login=null}
 async request(path,options={}){
  assert(this.token,'Connect a fine-grained GitHub token first');
  const response=await fetch(path.startsWith('https://')?path:ROOT+path,{
   ...options,
   cache:'no-store',
   headers:{
    'Accept':'application/vnd.github+json',
    'Authorization':'Bearer '+this.token,
    'X-GitHub-Api-Version':'2022-11-28',
    ...(options.body?{'Content-Type':'application/json'}:{}),
    ...(options.headers||{})
   }
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   const errors=Array.isArray(data.errors)?data.errors.map(e=>e.message||e.code).join('; '):'';
   const note=errors||data.message||'GitHub rejected this request';
   throw Error('GitHub HTTP '+response.status+': '+note);
  }
  return data;
 }
 async connect(value){
  const candidate=value.trim();
  assert(candidate.length>20,'Paste your repository-scoped fine-grained personal access token');
  // Nothing is persisted: no localStorage, cookie, URL parameters or browser session storage.
  this.token=candidate;
  try{
   const user=await this.request('https://api.github.com/user');
   const repo=await this.request('');
   assert(repo.full_name===OWNER+'/'+REPO,'Unexpected repository response');
   assert(repo.permissions?.push===true,'GitHub account does not have write permission for this repository');
   this.login=user.login;
   return user.login;
  }catch(e){this.disconnect();throw e}
 }
 async save(changes,originals){
  assert(this.connected(),'Connect GitHub before saving');
  assert(Array.isArray(changes)&&changes.length>0,'No changed YAML files');
  for(const c of changes)assert(ALLOWED.has(c.file),'Not an editable architecture file: '+c.file);
  // Read latest branch and confirm every edited file still matches the version originally loaded.
  const ref=await this.request('/git/ref/heads/'+BRANCH);
  const head=ref.object?.sha;
  assert(head,'Could not locate the main branch');
  const remote=await Promise.all(changes.map(async c=>{
   const f=await this.request('/contents/architecture/'+encodeURIComponent(c.file)+'?ref='+BRANCH);
   assert(f.type==='file'&&typeof f.content==='string','Unable to read '+c.file);
   return {file:c.file,content:decodeBase64(f.content)};
  }));
  for(const f of remote){
   const normalize=s=>s.replace(/\r\n/g,'\n');
   assert(normalize(f.content)===normalize(originals[f.file]),
    f.file+' has changed on GitHub since this editor loaded. Your draft has not been overwritten; copy or download it, then reload to reconcile.');
  }
  // One commit for the complete validated set; avoid partial commits when multiple YAML files change.
  const base=await this.request('/git/commits/'+head);
  assert(base.tree?.sha,'GitHub did not return a base tree');
  const tree=await this.request('/git/trees',{method:'POST',body:JSON.stringify({
   base_tree:base.tree.sha,
   tree:changes.map(c=>({path:'architecture/'+c.file,mode:'100644',type:'blob',content:c.content}))
  })});
  const filenames=changes.map(c=>c.file).join(', ');
  const commit=await this.request('/git/commits',{method:'POST',body:JSON.stringify({
   message:'Update architecture YAML via Explorer: '+filenames,
   tree:tree.sha,
   parents:[head]
  })});
  // Force=false preserves branch protection and fails on divergent/concurrent updates.
  const updated=await this.request('/git/refs/heads/'+BRANCH,{method:'PATCH',body:JSON.stringify({
   sha:commit.sha,force:false
  })});
  assert(updated.object?.sha===commit.sha,'GitHub did not confirm updating the branch');
  return {sha:commit.sha,url:'https://github.com/'+OWNER+'/'+REPO+'/commit/'+commit.sha};
 }
}
window.OneVisionGitHubSave=OneVisionGitHubSave;
})();