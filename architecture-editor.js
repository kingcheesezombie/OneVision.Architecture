(()=>{
'use strict';
const FILES=[
 ['meta.yaml','Metadata',['version','updated']],
 ['applications.yaml','Applications',['applications']],
 ['capabilities.yaml','Capabilities',['capabilities']],
 ['sources.yaml','External sources',['externalMappings']],
 ['workflows.yaml','Workflows',['workflows']],
 ['endpoints.yaml','API endpoints',['endpoints']]
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const check=(condition,message)=>{if(!condition)throw Error(message)};
const keyed=(records,name)=>{
 check(Array.isArray(records),name+' must be a list');
 const result=new Map();
 for(const x of records){
  check(x&&typeof x==='object'&&!Array.isArray(x),name+' entries must be objects');
  check(typeof x.id==='string'&&x.id.trim(),name+' has an entry without an ID');
  check(!result.has(x.id),'Duplicate '+name+' ID '+x.id);
  result.set(x.id,x);
 }
 return result;
};
function parseAndValidate(drafts){
 check(window.jsyaml?.load,'YAML parser not available. Reload with an internet connection or edit on GitHub.');
 const model={};
 for(const [file,,keys] of FILES){
  const source=window.jsyaml.load(drafts[file],{json:false});
  check(source&&typeof source==='object'&&!Array.isArray(source),file+' must contain a YAML object');
  check(Object.keys(source).length===keys.length&&keys.every(k=>Object.hasOwn(source,k)),file+' must contain exactly: '+keys.join(', '));
  for(const key of keys)model[key]=source[key];
 }
 check(typeof model.version==='string','Metadata version must be a quoted string');
 check(typeof model.updated==='string','Metadata updated must be a quoted date string');
 const apps=keyed(model.applications,'Application');
 const caps=keyed(model.capabilities,'Capability');
 const endpoints=keyed(model.endpoints,'Endpoint');
 keyed(model.workflows,'Workflow');
 keyed(model.externalMappings,'External mapping');
 for(const c of model.capabilities)check(apps.has(c.provider),'Capability '+c.id+': unknown owner '+c.provider);
 for(const e of model.endpoints){
  check(apps.has(e.owner),'Endpoint '+e.id+': unknown owner '+e.owner);
  check(['GET','POST','PUT','PATCH','DELETE'].includes(e.method),'Endpoint '+e.id+': invalid HTTP method');
  check(typeof e.path==='string'&&e.path.startsWith('/'),'Endpoint '+e.id+': expected a relative API path');
 }
 for(const w of model.workflows){
  check(Array.isArray(w.steps)&&w.steps.length>0,'Workflow '+w.id+': steps required');
  check(Array.isArray(w.participants),'Workflow '+w.id+': participants required');
  const steps=keyed(w.steps,'Step in '+w.id),owners=new Set();
  for(const s of w.steps){
   check(caps.has(s.capability),'Workflow '+w.id+': unknown capability '+s.capability);
   check(!Object.hasOwn(s,'name')&&!Object.hasOwn(s,'description'),'Workflow '+w.id+': use canonical capability details');
   owners.add(caps.get(s.capability).provider);
   for(const next of s.next||[])check(steps.has(next),'Workflow '+w.id+': unknown next step '+next);
   check(['api','api-handler','internal','unspecified'].includes(s.connection?.kind||'unspecified'),'Workflow '+w.id+': invalid connection kind');
   for(const id of s.connection?.endpointIds||[])check(endpoints.has(id),'Workflow '+w.id+': unknown endpoint '+id);
  }
  check(w.participants.length===owners.size&&w.participants.every(x=>owners.has(x)),'Workflow '+w.id+': participants do not match capability owners');
 }
 for(const s of model.externalMappings){
  check(apps.has(s.targetApp),'Mapping '+s.id+': unknown target application '+s.targetApp);
  check(caps.has(s.targetCapability),'Mapping '+s.id+': unknown capability '+s.targetCapability);
  check(caps.get(s.targetCapability).provider===s.targetApp,'Mapping '+s.id+': target capability belongs to another application');
  check(s.status==='example','Mapping '+s.id+': external sources must remain explicitly labelled example');
  check(Array.isArray(s.fields)&&s.fields.length>0&&s.fields.every(x=>Array.isArray(x)&&x.length===2),'Mapping '+s.id+': fields must be pairs');
 }
 return model;
}
class ArchitectureScriptPanel{
 constructor(){
  this.drafts={};this.originals={};this.current='workflows.yaml';
  this.loading=null;this.timer=null;this.root=null;this.map=null;this.error=null;this.changed=false;
  this.github=new window.OneVisionGitHubSave();this.saving=false;this.review=false;this.saveNotice=null;this.valid=false;
 }
 async load(){
  if(this.loading)return this.loading;
  this.loading=Promise.all(FILES.map(async([file])=>{
    const response=await fetch('architecture/'+file,{cache:'no-store'});
    if(!response.ok)throw Error('Unable to load architecture/'+file+' (HTTP '+response.status+')');
    return [file,await response.text()];
  })).then(entries=>{
    for(const [file,value]of entries){this.originals[file]=value;if(!Object.hasOwn(this.drafts,file))this.drafts[file]=value}
    this.error=null;
  }).catch(error=>{this.error=error.message;throw error});
  return this.loading;
 }
 async mount(root,map){
  this.root=root;this.map=map;
  root.addEventListener('click',e=>{
   const action=e.target.closest('[data-script-action]');if(action)this.action(action.dataset.scriptAction);
  });
  root.addEventListener('change',e=>{
   if(e.target.matches('[data-script-file]'))this.choose(e.target.value);
   if(e.target.matches('[data-github-token]'))this.setToken();
  });
  root.addEventListener('input',e=>{
   if(!e.target.matches('[data-yaml-editor]'))return;
   this.drafts[this.current]=e.target.value;this.review=false;this.saveNotice=null;this.updateDirty();
   clearTimeout(this.timer);this.timer=setTimeout(()=>this.preview(),360);
  });
  this.renderLoading();
  try{await this.load();if(this.root===root){this.render();this.preview()}}
  catch(error){if(this.root===root)this.renderError(error.message)}
 }
 renderLoading(){this.root.innerHTML='<div class="script-panel-head"><strong>Architecture YAML</strong><span class="script-state">Loading files…</span></div>'}
 renderError(message){this.root.innerHTML='<div class="script-panel-head"><strong>Architecture YAML</strong></div><div role="alert" class="script-error">'+esc(message)+'</div><a target="_blank" rel="noopener" href="https://github.com/kingcheesezombie/OneVision.Architecture/tree/main/architecture">Open YAML files on GitHub</a>'}
 dirty(file){return this.drafts[file]!==this.originals[file]}
 updateDirty(){
  this.changed=FILES.some(([file])=>this.dirty(file));
  const label=this.root?.querySelector('[data-script-dirty]');
  if(label)label.textContent=this.changed?'Uncommitted preview':'Published definition';
  const save=this.root?.querySelector('[data-script-action="review"]');
  if(save)save.disabled=!this.changed||!this.valid||this.saving;
  const reset=this.root?.querySelector('[data-script-action="reset"]');if(reset)reset.disabled=!this.dirty(this.current);
 }
 render(){
  const select=FILES.map(([file,label])=>'<option value="'+file+'" '+(file===this.current?'selected':'')+'>'+esc(label+' — '+file)+(this.dirty(file)?' *':'')+'</option>').join('');
  this.root.innerHTML='<div class="script-panel-head"><div><h3>Architecture scripts</h3><p>Edit the YAML and preview its effect on the map.</p></div><span class="script-state" data-script-dirty></span></div>'+
    '<div class="script-panel-toolbar"><label>Definition <select data-script-file>'+select+'</select></label><a class="script-github-link" href="https://github.com/kingcheesezombie/OneVision.Architecture/edit/main/architecture/'+encodeURIComponent(this.current)+'" target="_blank" rel="noopener">Edit on GitHub ↗</a></div>'+
    '<textarea data-yaml-editor spellcheck="false" aria-label="Editable YAML source for '+esc(this.current)+'"></textarea>'+
    '<div class="script-status" data-script-status role="status" aria-live="polite"></div>'+
    '<div class="script-panel-actions"><button type="button" data-script-action="download">Download YAML</button><button type="button" data-script-action="copy">Copy YAML</button><button type="button" data-script-action="reset">Reset this file</button><button class="script-save-button" type="button" data-script-action="review" disabled>Review &amp; save to GitHub</button></div>'+
    '<div class="script-save-section"><strong>GitHub connection</strong><p>For direct publishing, use a fine-grained token restricted to this repository with Contents: Read and write. The token is used only in this tab and is not stored.</p>'+
    '<div class="script-token-row" data-script-connect><input type="password" autocomplete="off" data-github-token aria-label="GitHub fine-grained personal access token" placeholder="Paste fine-grained token"><button type="button" data-script-action="connect">Connect GitHub</button></div>'+
    '<div class="script-identity" data-script-identity></div><div data-script-review></div>'+
    '<a href="https://github.com/settings/personal-access-tokens/new?name=OneVision-Architecture-Editor&target_name=kingcheesezombie&expires_in=30&contents=write" target="_blank" rel="noopener noreferrer">Create a scoped token on GitHub ↗</a>'+
    '</div><p class="script-note">The preview is local until you explicitly confirm Save to GitHub. Saved changes trigger the GitHub Pages publishing workflow. If saving fails, your drafts are retained.</p>';
  this.root.querySelector('[data-yaml-editor]').value=this.drafts[this.current];
  this.updateDirty();
  this.renderConnection();
 }
 applyStructuredChange(file,content){
  if(!Object.hasOwn(this.drafts,file))throw Error('YAML file is not loaded: '+file);
  this.drafts[file]=content;this.review=false;this.saveNotice=null;
  this.changed=FILES.some(([name])=>this.drafts[name]!==this.originals[name]);
  if(this.root?.querySelector('[data-yaml-editor]')&&this.current===file){
   this.root.querySelector('[data-yaml-editor]').value=content;
  }
  const select=this.root?.querySelector('[data-script-file]');
  if(select){
   for(const option of select.options){
    const spec=FILES.find(([name])=>name===option.value);
    if(spec)option.textContent=spec[1]+' — '+spec[0]+(this.dirty(spec[0])?' *':'');
   }
  }
  this.preview();
 }
 openReview(){
  if(!this.root)return;
  this.review=true;this.renderReview();this.root.querySelector('[data-script-review]')?.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 choose(file){
  if(!Object.hasOwn(this.drafts,file))return;
  clearTimeout(this.timer);
  this.current=file;this.review=false;this.render();this.preview();
 }
 preview(){
  if(!this.map)return;
  try{
   const model=parseAndValidate(this.drafts);
   this.error=null;this.valid=true;
   this.map.setModel(model);
   const stat=this.root?.querySelector('[data-script-status]');
   if(stat){stat.className='script-status is-valid';stat.textContent=(this.changed?'Valid changes · Live preview applied':'Valid YAML · Showing published architecture')+' · '+model.workflows.length+' workflows · '+model.externalMappings.length+' external mappings';}
   this.updateDirty();
  }catch(error){
   this.error=error.message;this.valid=false;this.review=false;
   this.updateDirty();this.renderReview();
   const stat=this.root?.querySelector('[data-script-status]');
   if(stat){stat.className='script-status is-invalid';stat.textContent='Preview not applied: '+error.message+'. The last valid map remains visible.'}
  }
 }
 action(action){
  if(action==='connect'){this.connect();return}
  if(action==='disconnect'){this.github.disconnect();this.review=false;this.renderConnection();return}
  if(action==='review'){this.review=true;this.renderReview();return}
  if(action==='cancel-review'){this.review=false;this.renderReview();return}
  if(action==='confirm-save'){this.commit();return}
  if(action==='reset'){this.drafts[this.current]=this.originals[this.current];this.render();this.preview();return}
  const content=this.drafts[this.current];
  if(action==='copy'){
   if(navigator.clipboard?.writeText)navigator.clipboard.writeText(content).then(()=>this.flash('Copied YAML to clipboard')).catch(()=>this.flash('Clipboard unavailable. Select the text and copy manually.'));
   else this.flash('Clipboard unavailable. Select the text and copy manually.');
  }
  if(action==='download'){
   const url=URL.createObjectURL(new Blob([content],{type:'text/yaml;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download=this.current;link.click();URL.revokeObjectURL(url);
   this.flash('Downloaded '+this.current+'. Not published.');
  }
 }

 changedFiles(){return FILES.map(([file])=>file).filter(file=>this.dirty(file))}
 setToken(){ /* Token is read only when Connect is clicked, never copied to drafts or storage. */ }
 renderConnection(){
  const holder=this.root?.querySelector('[data-script-connect]'),identity=this.root?.querySelector('[data-script-identity]');
  if(holder)holder.hidden=this.github.connected();
  if(identity)identity.innerHTML=this.github.connected()?
   '<span class="script-connected">Connected as '+esc(this.github.login)+'</span> <button type="button" data-script-action="disconnect">Disconnect</button>':
   '<span>Not connected to GitHub</span>';
  this.renderReview();
 }
 async connect(){
  const field=this.root?.querySelector('[data-github-token]');if(!field)return;
  const value=field.value;field.value='';
  const action=this.root?.querySelector('[data-script-action="connect"]');if(action)action.disabled=true;
  try{
   const login=await this.github.connect(value);
   this.saveNotice='Connected to GitHub as '+login+'. The token is held only in memory.';
   this.renderConnection();this.flash(this.saveNotice);
  }catch(err){this.saveNotice=null;this.flash('Connection failed: '+err.message)}
  finally{if(action)action.disabled=false}
 }
 renderReview(){
  const root=this.root?.querySelector('[data-script-review]');if(!root)return;
  if(!this.review){root.innerHTML='';return}
  if(!this.valid||!this.changed){root.innerHTML='<p>Nothing valid to save.</p>';return}
  const names=this.changedFiles();
  root.innerHTML='<div class="script-review"><h4>Confirm GitHub commit</h4><p>These '+names.length+' changed YAML file(s) will be committed together on <strong>main</strong>:</p><ul>'+
   names.map(file=>'<li>'+esc(file)+'</li>').join('')+
   '</ul><p>The current GitHub versions will be checked before the commit. This will trigger automatic Pages publishing.</p>'+
   (this.github.connected()?'':'<p class="script-warning">Connect GitHub above to enable saving.</p>')+
   '<div class="script-review-actions"><button type="button" data-script-action="cancel-review">Cancel</button><button type="button" class="script-save-button" data-script-action="confirm-save" '+(!this.github.connected()||this.saving?'disabled':'')+'>'+(this.saving?'Saving…':'Confirm save to GitHub')+'</button></div></div>';
 }
 async commit(){
  if(this.saving)return;
  try{parseAndValidate(this.drafts)}catch(e){this.flash('Cannot save invalid YAML: '+e.message);return}
  if(!this.changed||!this.github.connected())return;
  const names=this.changedFiles();
  this.saving=true;this.renderReview();
  this.flash('Checking GitHub versions and creating one commit for '+names.length+' YAML file(s)…');
  try{
   const changes=names.map(file=>({file,content:this.drafts[file]}));
   const result=await this.github.save(changes,this.originals);
   for(const file of names)this.originals[file]=this.drafts[file];
   this.review=false;this.saveNotice='Saved to GitHub: '+result.sha.slice(0,9)+'. GitHub Pages publication has been triggered.';
   // The published site may still be the previous build; the preview remains the authoritative view of the saved changes.
   this.render();this.preview();
   const stat=this.root.querySelector('[data-script-status]');
   if(stat){stat.className='script-status is-valid';stat.innerHTML=esc(this.saveNotice)+' <a href="'+result.url+'" target="_blank" rel="noopener noreferrer">View commit ↗</a>'}
  }catch(err){this.flash('Not saved: '+err.message+'. Your edits are preserved.')}
  finally{this.saving=false;this.renderReview();this.updateDirty()}
 }
 flash(text){const s=this.root?.querySelector('[data-script-status]');if(s)s.textContent=text}
}
window.ArchitectureScriptPanel=ArchitectureScriptPanel;
window.validateArchitecturePreview=parseAndValidate;
})();