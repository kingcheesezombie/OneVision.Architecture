(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap=(m,id)=>m.capabilities.find(c=>c.id===id);
const action=(kind,id,title,sub)=>'<button class="lane-link" data-kind="'+kind+'" data-id="'+esc(id)+'"><span><strong>'+esc(title)+'</strong>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span><span aria-hidden="true">›</span></button>';
class IntegrationMap{
 constructor(root,model,navigate,filters={}){
  this.root=root;this.model=model;this.navigate=navigate;this.filters=filters;
  this.layers={workflows:true,external:true,planned:true,standard:false};
  this.entityClass='all';this.selection=null;
  root.addEventListener('click',e=>{const el=e.target.closest('[data-map-action],[data-kind],[data-map-source],[data-map-app],[data-map-workflow]');if(el){e.stopPropagation();this.click(el)}});
  root.addEventListener('change',e=>{
   const layer=e.target.closest('[data-map-filter]');if(layer){this.layers[layer.dataset.mapFilter]=layer.checked;this.render();return}
   const cls=e.target.closest('[data-map-class]');if(cls){this.entityClass=cls.value;this.render()}
  });
  this.render();
 }
 eligible(w){
  if(!this.layers.planned&&w.status==='planned')return false;
  if(this.filters.status&&this.filters.status!=='all'&&w.status!==this.filters.status)return false;
  const q=(this.filters.search||'').trim().toLowerCase();
  if(!q)return true;
  return [w.name,w.summary,...w.steps.map(s=>{const c=cap(this.model,s.capability);return [c?.name,c?.provider,c?.summary].join(' ')})].join(' ').toLowerCase().includes(q);
 }
 workflows(){return this.layers.workflows?this.model.workflows.filter(w=>this.eligible(w)):[]}
 sources(){
  if(!this.layers.external)return [];
  const q=(this.filters.search||'').trim().toLowerCase();
  return (this.model.externalMappings||[]).filter(x=>(this.entityClass==='all'||x.entityClass===this.entityClass)&&(!q||[x.name,x.entityClass,x.sourceExample,x.targetApp,x.description,...x.fields.flat()].join(' ').toLowerCase().includes(q)));
 }
 visibleApps(){return this.model.applications.filter(a=>(this.layers.planned||a.status!=='planned')&&(this.layers.standard||a.id!=='UI'))}
 click(el){
  if(el.dataset.mapAction==='clear'){this.selection=null;this.render();return}
  if(el.dataset.kind){this.navigate(el.dataset.kind,el.dataset.id);return}
  if(el.dataset.mapSource)this.selection={type:'source',id:el.dataset.mapSource};
  if(el.dataset.mapApp)this.selection={type:'app',id:el.dataset.mapApp};
  if(el.dataset.mapWorkflow)this.selection={type:'workflow',id:el.dataset.mapWorkflow};
  this.render();
 }
 related(w,id){return w.steps.some(s=>cap(this.model,s.capability)?.provider===id)}
 isFocused(id){
  if(!this.selection)return true;
  if(this.selection.type==='app')return this.selection.id===id;
  if(this.selection.type==='source')return this.model.externalMappings.find(x=>x.id===this.selection.id)?.targetApp===id;
  if(this.selection.type==='workflow'){const w=this.model.workflows.find(x=>x.id===this.selection.id);return !!w&&this.related(w,id)}
  return true;
 }
 visual(){
  const sources=this.sources(),flows=this.workflows(),apps=this.visibleApps();
  const head='<div class="lane-head"><span>EXTERNAL ENTITY CLASSES</span><span>ONEVISION APPLICATION</span><span>CAPABILITY WORKFLOWS</span></div>';
  const rows=apps.map(a=>{
   const external=sources.filter(s=>s.targetApp===a.id),ws=flows.filter(w=>this.related(w,a.id));
   const focus=this.isFocused(a.id),isSelected=this.selection?.type==='app'&&this.selection.id===a.id;
   const src=external.length?external.map(s=>'<button class="lane-source '+(this.selection?.id===s.id?'selected':'')+'" data-map-source="'+esc(s.id)+'"><strong>'+esc(s.name)+'</strong><small>'+esc(s.entityClass)+' · example</small></button>').join(''):'<span class="lane-empty">No examples shown</span>';
   const rel=ws.length?ws.map(w=>{
    const other=w.participants.filter(id=>id!==a.id).join(' + ');
    return '<button class="lane-workflow '+(this.selection?.id===w.id?'selected':'')+'" data-map-workflow="'+esc(w.id)+'"><strong>'+esc(w.name)+'</strong><small>'+esc(other?('With '+other):'Internal workflow')+(w.status==='planned'?' · Planned':'')+'</small></button>';
   }).join(''):'<span class="lane-empty">No workflows shown</span>';
   return '<div class="lane-row '+(focus?'':'dimmed')+'">'+
     '<div class="lane-cell lane-sources '+(external.length?'has-links':'')+'">'+(this.layers.external?src:'<span class="lane-empty">Layer hidden</span>')+'</div>'+
     '<div class="lane-cell lane-app-cell"><button class="lane-app '+(isSelected?'selected':'')+' '+(a.status==='planned'?'planned':'')+'" data-map-app="'+esc(a.id)+'"><strong>'+esc(a.id==='ONEVISION'?'OneVision':a.id==='UI'?'OneVision.UI':a.id)+'</strong><small>'+esc(a.tagline)+'</small></button></div>'+
     '<div class="lane-cell lane-workflows '+(ws.length?'has-links':'')+'">'+(this.layers.workflows?rel:'<span class="lane-empty">Layer hidden</span>')+'</div></div>';
  }).join('');
  return '<div class="lane-scroll"><div class="lane-diagram">'+head+rows+'</div></div>';
 }
 details(){
  const s=this.selection,m=this.model;
  if(!s)return '<div class="map-inspect"><strong>Explore an application, source, or workflow</strong><p>Everything has its own lane. External mappings sit alongside their receiving application, while shared workflow names identify the participating applications without overlapping lines. Select an item to inspect it.</p></div>';
  if(s.type==='source'){
   const x=m.externalMappings.find(v=>v.id===s.id);if(!x)return '';
   const c=cap(m,x.targetCapability);
   return '<div class="map-inspect"><span class="meta">ILLUSTRATIVE MAPPING — NOT A VERIFIED FEED</span><h3>'+esc(x.name)+' → '+esc(x.targetApp)+'</h3><p>'+esc(x.description)+'</p><p><strong>Example source:</strong> '+esc(x.sourceExample)+'</p><h4>Example field mappings</h4><div class="map-field-grid">'+x.fields.map(([from,to])=>'<div><code>'+esc(from)+'</code><span>→</span><span>'+esc(to)+'</span></div>').join('')+'</div><h4>Target inherent capability</h4>'+action('capability',c.id,c.name,c.provider)+'</div>';
  }
  if(s.type==='app'){
   const a=m.applications.find(v=>v.id===s.id),cs=m.capabilities.filter(c=>c.provider===s.id),ws=this.workflows().filter(w=>this.related(w,s.id)),ex=this.sources().filter(x=>x.targetApp===s.id);
   return '<div class="map-inspect"><span class="meta">APPLICATION</span><h3>'+esc(a.name)+'</h3><p>'+esc(a.description)+'</p>'+action('application',a.id,'Open application details','Source configuration and inherent capabilities')+
    '<h4>External mapping examples ('+ex.length+')</h4><div class="map-inspect-list">'+ex.map(x=>'<button class="map-link" data-map-source="'+esc(x.id)+'"><span><strong>'+esc(x.name)+'</strong><small>'+esc(x.entityClass)+'</small></span><span>›</span></button>').join('')+'</div>'+
    '<h4>Inherent capabilities ('+cs.length+')</h4><div class="map-inspect-list">'+cs.map(c=>action('capability',c.id,c.name,c.id)).join('')+'</div>'+
    '<h4>Participating workflows ('+ws.length+')</h4><div class="map-inspect-list">'+ws.map(w=>action('workflow',w.id,w.name,w.status==='planned'?'Planned':'Established')).join('')+'</div></div>';
  }
  const w=m.workflows.find(v=>v.id===s.id);if(!w)return '';
  return '<div class="map-inspect"><span class="meta">CAPABILITY WORKFLOW</span><h3>'+esc(w.name)+'</h3><p>'+esc(w.summary)+'</p><div class="map-step-list">'+w.steps.map((step,i)=>{const c=cap(m,step.capability);return '<div><span class="map-step-index">'+(i+1)+'</span>'+action('capability',c.id,c.name,c.provider)+'</div>'}).join('')+'</div>'+action('workflow',w.id,'Open full workflow','Sequence and API contracts')+'</div>';
 }
 render(){
  const classes=[...new Set((this.model.externalMappings||[]).map(x=>x.entityClass))];
  const check=(key,label)=>'<label class="map-toggle"><input type="checkbox" data-map-filter="'+key+'" '+(this.layers[key]?'checked':'')+'>'+label+'</label>';
  const head='<div class="map-header"><div><h2>Integration map</h2><p class="sub">Application-centred lanes keep sources and workflows readable, without crossing paths.</p></div><div class="map-tools"><button class="map-clear" data-map-action="clear" '+(!this.selection?'disabled':'')+'>Clear focus</button></div></div>';
  const filters='<div class="map-layers"><div class="map-filter-label">SHOW ON MAP</div>'+check('workflows','Workflow connections')+check('external','External entity mappings')+check('planned','Planned components')+check('standard','Design standard')+
   '<label class="map-class-filter">Entity class <select data-map-class '+(!this.layers.external?'disabled':'')+'><option value="all">All classes</option>'+classes.map(x=>'<option value="'+esc(x)+'" '+(this.entityClass===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label></div>';
  this.root.innerHTML=head+filters+this.visual()+'<div class="map-key"><span>Sources → application → workflows</span><span>'+this.sources().length+' mapping examples · '+this.workflows().length+' workflows</span></div>'+this.details();
 }
}
window.OneVisionIntegrationMap=IntegrationMap;
})();