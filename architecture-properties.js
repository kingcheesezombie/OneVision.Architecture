(()=>{
'use strict';
// Structured editing layer. The YAML draft remains the single source of truth.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowed=x=>typeof x==='string'?x:'';
const slug=s=>s.toUpperCase().trim().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');
class ArchitectureProperties{
 constructor(){this.root=null;this.map=null;this.scripts=null;this.selected=null;this.connectMode=false;this.problem=null}
 mount(root,map,scripts){
  this.root=root;this.map=map;this.scripts=scripts;this.selected=null;this.connectMode=false;
  root.addEventListener('click',e=>{
   const el=e.target.closest('[data-property-action]');if(!el)return;
   e.stopPropagation();
   this.action(el.dataset.propertyAction,el.dataset.index);
  });
  root.addEventListener('change',e=>{
   const el=e.target.closest('[data-property-field]');if(!el)return;
   this.setField(el.dataset.propertyField,el.value,el.dataset.index);
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
  this.connectMode=false;
  this.selected=selection?.type==='source'||selection?.type==='app'?{...selection}:null;
  this.render();
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
 newEntity(){
  const model=this.model(),target=model?.applications.find(a=>model.capabilities.some(c=>c.provider===a.id)&&a.id!=='ONEVISION'&&a.id!=='UI');
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
  if(type==='add'){this.newEntity();return}
  if(type==='close'){this.selected=null;this.connectMode=false;this.map.selection=null;this.map.render();this.render();return}
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
 render(){
  if(!this.root)return;
  const model=this.model(),entry=this.entity();
  const top='<div class="properties-header"><div><h3>Architecture properties</h3><p>Visual editing updates <code>sources.yaml</code></p></div><button type="button" class="properties-add" data-property-action="add">+ External entity</button></div>';
  const footer='<div class="properties-footer"><span>'+esc(this.scripts?.changed?'Uncommitted YAML changes':'No unsaved changes')+'</span><button type="button" data-property-action="review" '+(!this.scripts?.changed?'disabled':'')+'>Review &amp; save to GitHub</button></div>';
  if(this.problem){/* Keep editing available, show issue beneath header. */}
  let body='';
  if(!model||!this.scripts?.drafts['sources.yaml'])body='<p class="properties-hint">Loading architecture definitions…</p>';
  else if(!entry){
   if(this.selected?.type==='app'){
    const app=model.applications.find(x=>x.id===this.selected.id);
    body='<p class="properties-hint">'+esc(app?.name||this.selected.id)+' selected. Choose an external entity, or add one and connect it here.</p>';
   }else body='<p class="properties-hint">Select an external entity in the helicopter map to edit its properties and connection, or choose <strong>+ External entity</strong> to create one.</p>';
  }else{
   const input=(field,label,value,readonly=false)=>'<label class="property-field"><span>'+label+'</span><input data-property-field="'+field+'" value="'+esc(value)+'" '+(readonly?'readonly':'')+'></label>';
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
  const parent=this.root.parentElement;parent?.classList.toggle('has-properties',!!entry);
 }
}
window.ArchitectureProperties=ArchitectureProperties;
})();