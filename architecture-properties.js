(()=>{
'use strict';
// Structured editing layer. The YAML draft remains the single source of truth.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowed=x=>typeof x==='string'?x:'';
const slug=s=>s.toUpperCase().trim().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');
class ArchitectureProperties{
 constructor(){this.root=null;this.map=null;this.scripts=null;this.selected=null;this.connectMode=false;this.problem=null;this.integrationDraft=null}
 mount(root,map,scripts){
  this.root=root;this.map=map;this.scripts=scripts;this.selected=null;this.connectMode=false;
  root.addEventListener('click',e=>{
   const el=e.target.closest('[data-property-action]');if(!el)return;
   e.stopPropagation();
   this.action(el.dataset.propertyAction,el.dataset.index);
  });
  root.addEventListener('change',e=>{
   const el=e.target.closest('[data-property-field]');if(!el)return;
   if(el.dataset.propertyField.startsWith('integration'))this.setIntegrationField(el.dataset.propertyField,el.value);
   else this.setField(el.dataset.propertyField,el.value,el.dataset.index);
  });
  this.render();
 }
 async ready(){
  try{await this.scripts.load();this.render()}catch(e){this.problem='YAML could not be loaded: '+e.message;this.render()}
 }
 list(){return this.scripts?.drafts['sources.yaml']&&window.jsyaml?.load(this.scripts.drafts['sources.yaml'])?.externalMappings||[]}
 model(){return this.map?.model}
 status(message){this.problem=message;this.render()}
 select(selection){
  if(this.connectMode&&selection?.type==='app'&&this.selected?.type==='source'){
   this.setTarget(selection.id);return;
  }
  this.connectMode=false;this.integrationDraft=null;
  this.selected=selection?.type==='source'||selection?.type==='app'?{...selection}:null;
  this.problem=null;this.render();
 }
 edit(mutator,selectId){
  if(!this.scripts?.drafts['sources.yaml']){this.status('YAML is still loading');return}
  try{
   const data=window.jsyaml.load(this.scripts.drafts['sources.yaml']);
   if(!Array.isArray(data?.externalMappings))throw Error('sources.yaml is missing externalMappings');
   mutator(data.externalMappings);
   this.scripts.applyStructuredChange('sources.yaml',window.jsyaml.dump(data,{lineWidth:-1,noRefs:true,sortKeys:false}));
   if(selectId){this.selected={type:'source',id:selectId};this.map.selection={type:'source',id:selectId};this.map.render()}
   this.problem=null;this.render();
  }catch(e){this.status('Cannot update YAML: '+e.message)}
 }
 newEntity(targetId){
  const model=this.model(),target=model?.applications.find(a=>a.id===targetId&&model.capabilities.some(c=>c.provider===a.id));
  if(!target){this.status('Add a canonical capability before creating an external entity');return}
  const cap=model.capabilities.find(c=>c.provider===target.id);
  const existing=new Set(this.list().map(x=>x.id));
  let id='EXT-'+target.id+'-NEW-ENTITY',n=2;
  while(existing.has(id)){id='EXT-'+target.id+'-NEW-ENTITY-'+n;n++}
  this.map.layers.external=true;this.map.entityClass='all';
  this.edit(items=>items.push({
   id,entityClass:'NEW_ENTITY',name:'New external entity',
   targetApp:target.id,targetCapability:cap.id,
   sourceExample:'Illustrative external source',
   description:'Describe the external entity and its mapping purpose.',
   fields:[['SourceIdentifier','Source record identifier']],
   status:'example'
  }),id);
 }
 entity(){return this.selected?.type==='source'?this.list().find(x=>x.id===this.selected.id):null}
 setField(field,value,index){
  const current=this.entity();if(!current)return;
  if(field==='targetApp'){this.setTarget(value);return}
  if(field==='targetCapability'){
   const cap=this.model().capabilities.find(c=>c.id===value);
   if(!cap||cap.provider!==current.targetApp){this.status('Choose a capability owned by '+current.targetApp);return}
  }
  if(field==='id'){
   value=slug(value);
   if(!value||this.list().some(x=>x.id===value&&x.id!==current.id)){this.status('The ID must be unique and contain letters or numbers');return}
  }
  if(field==='entityClass'){value=slug(value).replace(/-/g,'_');if(!value){this.status('Entity class is required');return}}
  if(['name','description','sourceExample'].includes(field)&&!value.trim()){this.status('This field cannot be blank');return}
  const id=field==='id'?value:current.id;
  this.edit(items=>{
   const x=items.find(item=>item.id===current.id);
   if(field==='fieldSource'||field==='fieldMeaning'){
    x.fields[Number(index)][field==='fieldSource'?0:1]=value;
   }else x[field]=value;
  },id);
 }
 setTarget(id){
  const current=this.entity(),app=this.model()?.applications.find(a=>a.id===id);
  const targetCap=this.model()?.capabilities.find(c=>c.provider===id);
  if(!current||!app||!targetCap){this.status('Target application must have a documented capability');return}
  this.connectMode=false;
  this.map.layers.external=true;this.map.entityClass='all';
  this.edit(items=>{
   const x=items.find(s=>s.id===current.id);x.targetApp=id;
   if(!this.model().capabilities.some(c=>c.id===x.targetCapability&&c.provider===id))x.targetCapability=targetCap.id;
  },current.id);
 }
 action(type,index){
  if(type==='add'){if(this.selected?.type==='app')this.newEntity(this.selected.id);return}
  if(type==='integration'){this.startIntegration();return}
  if(type==='integration-cancel'){this.integrationDraft=null;this.problem=null;this.render();return}
  if(type==='integration-create'){this.createIntegration();return}
  if(type==='close'){this.selected=null;this.connectMode=false;this.integrationDraft=null;this.map.selection=null;this.map.render();this.render();return}
  if(type==='connect'){this.connectMode=!this.connectMode;this.render();return}
  if(type==='cancel-connect'){this.connectMode=false;this.render();return}
  if(type==='add-field'){
   const e=this.entity();if(!e)return;
   this.edit(items=>items.find(x=>x.id===e.id).fields.push(['NewSourceField','Target meaning']),e.id);
   return;
  }
  if(type==='remove-field'){
   const e=this.entity();if(!e||e.fields.length<2){this.status('An external mapping requires at least one field');return}
   this.edit(items=>items.find(x=>x.id===e.id).fields.splice(Number(index),1),e.id);
   return;
  }
  if(type==='delete'){
   const e=this.entity();if(!e)return;
   if(!confirm('Remove external mapping '+e.name+' from the YAML draft? This is not saved to GitHub until you confirm.'))return;
   this.edit(items=>items.splice(items.findIndex(x=>x.id===e.id),1));
   this.selected=null;this.map.selection=null;this.map.render();this.render();return;
  }
  if(type==='review'){
   const details=document.querySelector('.architecture-script-expander');
   if(details)details.open=true;
   this.scripts.openReview();
   details?.scrollIntoView({behavior:'smooth',block:'start'});
  }
 }

 startIntegration(){
  const appId=this.selected?.type==='app'?this.selected.id:null;
  if(!appId)return;
  const other=this.model().applications.find(a=>a.id!==appId&&a.id!=='UI'&&this.model().capabilities.some(c=>c.provider===a.id));
  const sourceCap=this.model().capabilities.find(c=>c.provider===appId);
  const targetCap=other&&this.model().capabilities.find(c=>c.provider===other.id);
  if(!other||!sourceCap||!targetCap){this.status('An integration requires two applications with defined capabilities.');return}
  this.integrationDraft={
   id:'WF-'+appId+'-'+other.id+'-NEW',
   name:appId+' to '+other.id+' integration',
   summary:'Planned capability relationship; implementation contract not yet defined.',
   targetApp:other.id,sourceCapability:sourceCap.id,targetCapability:targetCap.id
  };
  this.problem=null;this.render();
 }
 setIntegrationField(field,value){
  const draft=this.integrationDraft;
  if(!draft)return;
  const model=this.model();
  if(field==='integrationTarget'){
   const app=model.applications.find(a=>a.id===value);
   if(!app||value===this.selected.id){this.status('Select a different application.');return}
   const next=model.capabilities.find(c=>c.provider===value);
   if(!next){this.status('The receiving application must own a capability.');return}
   draft.targetApp=value;draft.targetCapability=next.id;
  }else if(field==='integrationSourceCap'){
   if(!model.capabilities.some(c=>c.id===value&&c.provider===this.selected.id)){this.status('Select a capability owned by '+this.selected.id);return}
   draft.sourceCapability=value;
  }else if(field==='integrationTargetCap'){
   if(!model.capabilities.some(c=>c.id===value&&c.provider===draft.targetApp)){this.status('Select a capability owned by '+draft.targetApp);return}
   draft.targetCapability=value;
  }else if(field==='integrationId')draft.id=slug(value);
  else if(field==='integrationName')draft.name=value.trim();
  else if(field==='integrationSummary')draft.summary=value.trim();
  this.problem=null;this.render();
 }
 createIntegration(){
  const draft=this.integrationDraft;if(!draft)return;
  const from=this.selected?.id,to=draft.targetApp;
  const id=slug(draft.id);
  if(!id||!draft.name.trim()||!draft.summary.trim()){this.status('Integration ID, name and summary are required.');return}
  const model=this.model();
  if(!model.applications.some(a=>a.id===from)||!model.applications.some(a=>a.id===to)||from===to){this.status('Choose two distinct applications.');return}
  if(!model.capabilities.some(c=>c.id===draft.sourceCapability&&c.provider===from)||!model.capabilities.some(c=>c.id===draft.targetCapability&&c.provider===to)){this.status('Choose valid capabilities owned by the participating applications.');return}
  try{
   const data=window.jsyaml.load(this.scripts.drafts['workflows.yaml']);
   if(!Array.isArray(data?.workflows))throw Error('workflows.yaml is missing workflows');
   if(data.workflows.some(w=>w.id===id))throw Error('Workflow ID already exists: '+id);
   data.workflows.push({
    id,name:draft.name,summary:draft.summary,status:'planned',
    participants:[from,to],
    steps:[
     {id:'source',capability:draft.sourceCapability,next:['destination'],connection:{kind:'unspecified',endpointIds:[],note:'Integration contract not yet verified or defined.'}},
     {id:'destination',capability:draft.targetCapability,next:[],connection:{kind:'unspecified',endpointIds:[],note:'Planned receiving capability; no API endpoint asserted.'}}
    ]
   });
   this.scripts.applyStructuredChange('workflows.yaml',window.jsyaml.dump(data,{lineWidth:-1,noRefs:true,sortKeys:false}));
   this.integrationDraft=null;this.problem=null;
   this.map.layers.workflows=true;this.map.layers.planned=true;
   this.map.selection={type:'edge',id:[from,to].sort().join('|')};
   this.map.render();this.selected={type:'app',id:from};
   this.render();
  }catch(error){this.status('Cannot add integration: '+error.message)}
 }
 integrationForm(){
  const draft=this.integrationDraft,model=this.model(),from=this.selected?.id;if(!draft)return '';
  const apps=model.applications.filter(a=>a.id!==from&&a.id!=='UI'&&model.capabilities.some(c=>c.provider===a.id));
  const capsFrom=model.capabilities.filter(c=>c.provider===from);
  const capsTo=model.capabilities.filter(c=>c.provider===draft.targetApp);
  const select=(field,label,items,value)=>'<label class="property-field"><span>'+label+'</span><select data-property-field="'+field+'">'+items.map(item=>'<option value="'+esc(item.id)+'" '+(item.id===value?'selected':'')+'>'+esc(item.name||item.id)+' ('+esc(item.id)+')</option>').join('')+'</select></label>';
  const input=(field,label,value)=>'<label class="property-field"><span>'+label+'</span><input data-property-field="'+field+'" value="'+esc(value)+'"></label>';
  return '<div class="properties-selected"><strong>New integration from '+esc(from)+'</strong></div>'+
   '<p class="properties-hint">Create a planned workflow between two application capabilities. This does not claim a live API integration.</p>'+
   select('integrationTarget','Receiving application',apps,draft.targetApp)+
   select('integrationSourceCap','Source capability',capsFrom,draft.sourceCapability)+
   select('integrationTargetCap','Receiving capability',capsTo,draft.targetCapability)+
   input('integrationId','Workflow ID',draft.id)+input('integrationName','Workflow name',draft.name)+
   '<label class="property-field"><span>Purpose</span><textarea rows="3" data-property-field="integrationSummary">'+esc(draft.summary)+'</textarea></label>'+
   '<p class="properties-hint">Status: Planned. API contract: Unspecified. Both can be refined later in the workflow YAML.</p>'+
   '<div class="properties-actions"><button type="button" data-property-action="integration-cancel">Cancel</button><button type="button" class="properties-add" data-property-action="integration-create">Add integration</button></div>';
 }
 render(){
  if(!this.root)return;
  const model=this.model(),entry=this.entity();
  const application=this.selected?.type==='app'?model?.applications.find(a=>a.id===this.selected.id):null;
  const top='<div class="properties-header"><div><h3>'+esc(application?application.name:entry?'External entity':'Architecture')+'</h3><p>'+esc(application?'Application actions':entry?'External entity properties':'Select an application or external entity')+'</p></div></div>';
  const footer='<div class="properties-footer"><span>'+esc(this.scripts?.changed?'Uncommitted changes':'No unsaved changes')+'</span><button type="button" data-property-action="review" '+(!this.scripts?.changed||!this.scripts?.valid?'disabled':'')+'>Review &amp; save</button></div>';
  let body='';
  if(!model||!this.scripts?.drafts['sources.yaml'])body='<p class="properties-hint">Loading architecture definitions…</p>';
  else if(this.integrationDraft)body=this.integrationForm();
  else if(application){
   const available=model.capabilities.some(c=>c.provider===application.id);
   const number=model.externalMappings.filter(x=>x.targetApp===application.id).length;
   body='<div class="properties-selected"><strong>'+esc(application.tagline||application.id)+'</strong></div>'+
    '<p class="properties-hint">'+esc(application.description)+'</p>'+
    '<div class="properties-context-actions"><button type="button" class="properties-add" data-property-action="add" '+(!available?'disabled':'')+'>+ Add external entity</button>'+
    '<button type="button" class="properties-add" data-property-action="integration" '+(!available||application.id==='UI'?'disabled':'')+'>+ Add integration</button></div>'+
    '<p class="properties-hint">'+number+' external mapping'+(number===1?'':'s')+' currently targeted to '+esc(application.id)+'. Select one on the map to edit it.</p>';
  }else if(!entry){
   body='<p class="properties-hint">Click an application to add an external entity or integration. Click an external entity to edit or delete it.</p>';
  }else{
   const input=(field,label,value)=>'<label class="property-field"><span>'+label+'</span><input data-property-field="'+field+'" value="'+esc(value)+'"></label>';
   const textarea=(field,label,value)=>'<label class="property-field"><span>'+label+'</span><textarea data-property-field="'+field+'" rows="3">'+esc(value)+'</textarea></label>';
   const options=(items,selected)=>items.map(o=>'<option value="'+esc(o.id)+'" '+(o.id===selected?'selected':'')+'>'+esc(o.id+(o.name?' — '+o.name:''))+'</option>').join('');
   const apps=model.applications.filter(a=>model.capabilities.some(c=>c.provider===a.id)&&a.id!=='UI'&&a.id!=='ONEVISION');
   const caps=model.capabilities.filter(c=>c.provider===entry.targetApp);
   const fields=(entry.fields||[]).map(([src,meaning],i)=>'<div class="property-field-row"><input aria-label="Source field '+(i+1)+'" data-property-field="fieldSource" data-index="'+i+'" value="'+esc(src)+'"><input aria-label="Target meaning '+(i+1)+'" data-property-field="fieldMeaning" data-index="'+i+'" value="'+esc(meaning)+'"><button type="button" data-property-action="remove-field" data-index="'+i+'" aria-label="Remove field '+(i+1)+'">×</button></div>').join('');
   body='<div class="properties-selected"><strong>'+esc(entry.name)+'</strong><button type="button" data-property-action="close" aria-label="Close properties">×</button></div>'+
    input('id','Mapping ID',entry.id)+input('entityClass','External entity class',entry.entityClass)+input('name','Display name',entry.name)+textarea('description','Description',entry.description)+input('sourceExample','Example data source',entry.sourceExample)+
    '<div class="property-connection"><div><strong>Destination connection</strong><p>Choose the receiving application and a capability it owns.</p></div>'+
    '<label class="property-field"><span>Target application</span><select data-property-field="targetApp">'+options(apps,entry.targetApp)+'</select></label>'+
    '<label class="property-field"><span>Target capability</span><select data-property-field="targetCapability">'+options(caps,entry.targetCapability)+'</select></label>'+
    '<button type="button" class="properties-connect" data-property-action="connect">'+(this.connectMode?'Cancel connecting':'Connect on map')+'</button>'+
    (this.connectMode?'<p class="properties-connect-hint">Now select a receiving application on the helicopter map.</p>':'')+'</div>'+
    '<div class="property-fields"><div class="property-fields-head"><strong>Example field mappings</strong><button type="button" data-property-action="add-field">+ Field</button></div><div class="property-field-headings"><span>Source field</span><span>Target meaning</span></div>'+fields+'</div>'+
    '<div class="property-meta"><span>Classification: illustrative example</span><button type="button" data-property-action="delete">Delete entity</button></div>';
  }
  this.root.innerHTML=top+(this.problem?'<div class="properties-error" role="alert">'+esc(this.problem)+'</div>':'')+body+footer;
  this.root.parentElement?.classList.toggle('has-properties',!!application||!!entry||!!this.integrationDraft);
 }

}
window.ArchitectureProperties=ArchitectureProperties;
})();