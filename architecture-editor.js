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
  });
  root.addEventListener('input',e=>{
   if(!e.target.matches('[data-yaml-editor]'))return;
   this.drafts[this.current]=e.target.value;this.updateDirty();
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
  const reset=this.root?.querySelector('[data-script-action="reset"]');if(reset)reset.disabled=!this.dirty(this.current);
 }
 render(){
  const select=FILES.map(([file,label])=>'<option value="'+file+'" '+(file===this.current?'selected':'')+'>'+esc(label+' — '+file)+(this.dirty(file)?' *':'')+'</option>').join('');
  this.root.innerHTML='<div class="script-panel-head"><div><h3>Architecture scripts</h3><p>Edit the YAML and preview its effect on the map.</p></div><span class="script-state" data-script-dirty></span></div>'+
    '<div class="script-panel-toolbar"><label>Definition <select data-script-file>'+select+'</select></label><a class="script-github-link" href="https://github.com/kingcheesezombie/OneVision.Architecture/edit/main/architecture/'+encodeURIComponent(this.current)+'" target="_blank" rel="noopener">Edit on GitHub ↗</a></div>'+
    '<textarea data-yaml-editor spellcheck="false" aria-label="Editable YAML source for '+esc(this.current)+'"></textarea>'+
    '<div class="script-status" data-script-status role="status" aria-live="polite"></div>'+
    '<div class="script-panel-actions"><button type="button" data-script-action="download">Download YAML</button><button type="button" data-script-action="copy">Copy YAML</button><button type="button" data-script-action="reset">Reset this file</button></div>'+
    '<p class="script-note">Changes preview locally only. They do not publish to GitHub. To save permanently, use <strong>Edit on GitHub</strong> and commit the same content, or download the file.</p>';
  this.root.querySelector('[data-yaml-editor]').value=this.drafts[this.current];
  this.updateDirty();
 }
 choose(file){
  if(!Object.hasOwn(this.drafts,file))return;
  clearTimeout(this.timer);
  this.current=file;this.render();this.preview();
 }
 preview(){
  if(!this.map)return;
  try{
   const model=parseAndValidate(this.drafts);
   this.error=null;
   this.map.setModel(model);
   const stat=this.root?.querySelector('[data-script-status]');
   if(stat){stat.className='script-status is-valid';stat.textContent=(this.changed?'Valid changes · Live preview applied':'Valid YAML · Showing published architecture')+' · '+model.workflows.length+' workflows · '+model.externalMappings.length+' external mappings';}
  }catch(error){
   this.error=error.message;
   const stat=this.root?.querySelector('[data-script-status]');
   if(stat){stat.className='script-status is-invalid';stat.textContent='Preview not applied: '+error.message+'. The last valid map remains visible.'}
  }
 }
 action(action){
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
 flash(text){const s=this.root?.querySelector('[data-script-status]');if(s)s.textContent=text}
}
window.ArchitectureScriptPanel=ArchitectureScriptPanel;
window.validateArchitecturePreview=parseAndValidate;
})();