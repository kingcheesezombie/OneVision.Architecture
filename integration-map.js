(()=>{
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coords={IDM:[395,150],EAM:[740,145],HDM:[395,400],ODM:[740,410],KPI:[395,660],ONEVISION:[1010,400],UI:[1010,665]};
const sourceCoords={"EXT-IDM-PERSON":[115,90],"EXT-IDM-EPISODE":[115,210],"EXT-EAM-ASSET":[115,330],"EXT-EAM-ATTRIBUTE":[115,450],"EXT-HDM-HIER":[115,570],"EXT-KPI-VALUE":[115,690],"EXT-ODM-UNIT":[115,810]};

const names={IDM:'People',EAM:'Entities & allocations',HDM:'Hierarchies',ODM:'Organisation',KPI:'Measurement',ONEVISION:'Suite hub',UI:'Design standard'};
const cap=(m,id)=>m.capabilities.find(c=>c.id===id);
const pairs=m=>{
 const result=new Map();
 for(const w of m.workflows){
  const owners=[...new Set(w.steps.map(s=>cap(m,s.capability)?.provider).filter(Boolean))];
  for(let a=0;a<owners.length;a++)for(let b=a+1;b<owners.length;b++){
   const [from,to]=[owners[a],owners[b]].sort();
   const id=from+'|'+to;
   if(!result.has(id))result.set(id,{id,from,to,workflows:[]});
   result.get(id).workflows.push(w);
  }
 }
 return [...result.values()];
};
const button=(kind,id,text,sub)=>'<button class="map-link" data-kind="'+kind+'" data-id="'+escape(id)+'"><span><strong>'+escape(text)+'</strong>'+(sub?'<small>'+escape(sub)+'</small>':'')+'</span><span aria-hidden="true">›</span></button>';
class IntegrationMap{
 constructor(root,m,navigate,filters={}){
  this.root=root;this.model=m;this.navigate=navigate;this.filters=filters;
  this.selection=null;this.zoom=1;this.allPairs=pairs(m);
  this.layers={workflows:true,external:true,planned:true,standard:true};this.entityClass='all';
  root.addEventListener('click',e=>{if(e.target.closest('[data-map-action],[data-kind],[data-map-node],[data-map-pair],[data-map-workflow],[data-map-source]')){e.stopPropagation();this.click(e)}});
  root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-map-node],[data-map-pair],[data-map-source]')){e.preventDefault();this.click({target:e.target})}});
  root.addEventListener('change',e=>{
   const filter=e.target.closest('[data-map-filter]');if(filter){this.layers[filter.dataset.mapFilter]=filter.checked;this.render();return}
   const cls=e.target.closest('[data-map-class]');if(cls){this.entityClass=cls.value;this.render()}
  });
  this.render();
 }
 eligible(w){
  if(this.filters.status&&this.filters.status!=='all'&&w.status!==this.filters.status)return false;
  const q=(this.filters.search||'').trim().toLowerCase();
  if(!q)return true;
  return [w.id,w.name,w.summary,...w.steps.map(s=>{const c=cap(this.model,s.capability);return [c?.name,c?.provider,c?.summary].join(' ')})].join(' ').toLowerCase().includes(q);
 }
 shownPairs(){if(!this.layers.workflows)return [];return this.allPairs.map(p=>({...p,workflows:p.workflows.filter(w=>this.eligible(w)&&(this.layers.planned||w.status!=='planned'))})).filter(p=>p.workflows.length)}
 shownMappings(){
  if(!this.layers.external)return [];
  const q=(this.filters.search||'').trim().toLowerCase();
  return (this.model.externalMappings||[]).filter(x=>(this.entityClass==='all'||x.entityClass===this.entityClass)&&(!q||[x.name,x.entityClass,x.sourceExample,x.targetApp,x.description,...x.fields.flat()].join(' ').toLowerCase().includes(q)));
 }
 click(e){
  const action=e.target.closest('[data-map-action]');
  if(action){
   const a=action.dataset.mapAction;
   if(a==='clear')this.selection=null;
   if(a==='zoom-in')this.zoom=Math.min(1.7,this.zoom+.2);
   if(a==='zoom-out')this.zoom=Math.max(1,this.zoom-.2);
   if(a==='zoom-reset')this.zoom=1;
   this.render();return;
  }
  const next=e.target.closest('[data-kind]');
  if(next){this.navigate(next.dataset.kind,next.dataset.id);return}
  const src=e.target.closest('[data-map-source]');if(src){this.selection={type:'source',id:src.dataset.mapSource};this.render();return}
  const node=e.target.closest('[data-map-node]');
  if(node){this.selection={type:'app',id:node.dataset.mapNode};this.render();return}
  const pair=e.target.closest('[data-map-pair]');
  if(pair){this.selection={type:'pair',id:pair.dataset.mapPair};this.render();return}
  const wf=e.target.closest('[data-map-workflow]');
  if(wf){this.selection={type:'workflow',id:wf.dataset.mapWorkflow};this.render()}
 }
 focusPair(p){
  const s=this.selection;
  return !s||s.type==='source'&&false||s.type==='pair'&&s.id===p.id||s.type==='app'&&(s.id===p.from||s.id===p.to)||s.type==='workflow'&&p.workflows.some(w=>w.id===s.id);
 }
 focusNode(id){
  const s=this.selection;
  if(!s)return true;
  if(s.type==='source'){return this.model.externalMappings.find(x=>x.id===s.id)?.targetApp===id}
  if(s.type==='app')return id===s.id||this.shownPairs().some(p=>(p.from===s.id||p.to===s.id)&&(p.from===id||p.to===id))||this.shownMappings().some(x=>x.targetApp===s.id&&x.targetApp===id);
  if(s.type==='pair')return s.id.split('|').includes(id);
  if(s.type==='workflow'){const w=this.model.workflows.find(x=>x.id===s.id);return !!w?.steps.some(x=>cap(this.model,x.capability)?.provider===id)}
  return true;
 }
 point(from,to){
  const [ax,ay]=coords[from], [bx,by]=coords[to];
  const dx=bx-ax,dy=by-ay,d=Math.hypot(dx,dy)||1;
  return [ax+dx/d*87,ay+dy/d*43,bx-dx/d*87,by-dy/d*43];
 }
 path(p){
  const [x1,y1,x2,y2]=this.point(p.from,p.to);
  const mx=(x1+x2)/2,my=(y1+y2)/2;
  const cx=mx-(y2-y1)*.065,cy=my+(x2-x1)*.065;
  return 'M '+x1+' '+y1+' Q '+cx+' '+cy+' '+x2+' '+y2;
 }
 visual(){
  const all=this.shownPairs(),sources=this.shownMappings();
  const svg='<svg class="integration-svg" viewBox="'+((1170-1170/this.zoom)/2)+' '+((900-900/this.zoom)/2)+' '+(1170/this.zoom)+' '+(900/this.zoom)+'" role="group" aria-label="OneVision application and external entity mapping network">'+
  '<g class="map-links">'+all.map(p=>{
   const f=this.focusPair(p),planned=p.workflows.every(w=>w.status==='planned');
   return '<g class="map-edge '+(f?'':'muted')+'" data-map-pair="'+escape(p.id)+'" role="button" tabindex="0" aria-label="'+escape(p.from+' and '+p.to+': '+p.workflows.length+' workflows')+'">'+
   '<path class="map-edge-hit" d="'+this.path(p)+'"/><path class="map-edge-line '+(planned?'planned':'')+'" d="'+this.path(p)+'"/></g>';
  }).join('')+'</g>'+
  '<g class="map-external-links">'+sources.map(x=>{
    const p=sourceCoords[x.id],t=coords[x.targetApp];if(!p||!t)return '';
    const selected=this.selection?.type==='source'&&this.selection.id===x.id;
    const highlight=!this.selection||selected||this.selection.type==='app'&&this.selection.id===x.targetApp;
    const sx=p[0]+83,sy=p[1],tx=t[0]-90,ty=t[1];
    return '<g class="map-source-link '+(highlight?'':'muted')+'" data-map-source="'+escape(x.id)+'" role="button" tabindex="0" aria-label="'+escape(x.name+' maps into '+x.targetApp)+'"><path class="map-edge-hit" d="M'+sx+' '+sy+' Q'+((sx+tx)/2)+' '+sy+' '+tx+' '+ty+'"/><path d="M'+sx+' '+sy+' Q'+((sx+tx)/2)+' '+sy+' '+tx+' '+ty+'" class="map-source-line"/></g>';
  }).join('')+'</g>'+
  this.model.applications.filter(a=>this.layers.standard||a.id!=='UI').filter(a=>this.layers.planned||a.status!=='planned').map(a=>{
   const xy=coords[a.id];if(!xy)return '';
   const active=this.selection?.type==='app'&&this.selection.id===a.id;
   const muted=!this.focusNode(a.id);
   const w=a.id==='ONEVISION'?166:160,x=xy[0]-w/2,y=xy[1]-37;
   return '<g class="map-node '+(active?'selected ':'')+(muted?'muted ':'')+(a.status==='planned'?'planned':'')+'" data-map-node="'+escape(a.id)+'" role="button" tabindex="0" aria-label="Explore '+escape(a.name)+'">'+
   '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="74" rx="12"/>'+
   '<text class="map-node-name" x="'+xy[0]+'" y="'+(xy[1]-6)+'" text-anchor="middle">'+escape(a.id==='ONEVISION'?'OneVision':a.id==='UI'?'OneVision.UI':a.id)+'</text>'+
   '<text class="map-node-sub" x="'+xy[0]+'" y="'+(xy[1]+14)+'" text-anchor="middle">'+escape(names[a.id]||a.tagline)+'</text></g>';
  }).join('')+
  sources.map(x=>{
    const xy=sourceCoords[x.id];if(!xy)return '';
    const active=this.selection?.type==='source'&&this.selection.id===x.id;
    const dim=this.selection&&!(active||this.selection.type==='app'&&this.selection.id===x.targetApp);
    return '<g class="map-source '+(active?'selected ':'')+(dim?'muted':'')+'" data-map-source="'+escape(x.id)+'" role="button" tabindex="0" aria-label="'+escape('Example '+x.entityClass+' into '+x.targetApp)+'">'+
    '<rect x="'+(xy[0]-90)+'" y="'+(xy[1]-30)+'" width="180" height="60" rx="9"/>'+
    '<text class="map-source-name" x="'+xy[0]+'" y="'+(xy[1]-3)+'" text-anchor="middle">'+escape(x.name)+'</text>'+
    '<text class="map-source-meta" x="'+xy[0]+'" y="'+(xy[1]+16)+'" text-anchor="middle">Example · '+escape(x.entityClass)+'</text></g>';
  }).join('')+'</svg>';
  return '<div class="map-stage">'+svg+'</div>';
 }
 detail(){
  const s=this.selection,m=this.model;
  if(!s)return '<div class="map-inspect"><strong>Explore the architecture</strong><p>Select an application, workflow relationship or illustrative external entity class. Toggle layers or filter entity classes to focus the map.</p></div>';
  if(s.type==='source'){
   const x=(m.externalMappings||[]).find(y=>y.id===s.id);
   if(!x)return '';
   const c=cap(m,x.targetCapability);
   return '<div class="map-inspect"><span class="meta">ILLUSTRATIVE MAPPING — NOT A VERIFIED LIVE FEED</span><h3>'+escape(x.name)+' → '+escape(x.targetApp)+'</h3><p>'+escape(x.description)+'</p><p><strong>Example source:</strong> '+escape(x.sourceExample)+'</p><h4>Example field mappings</h4><div class="map-field-grid">'+x.fields.map(([from,to])=>'<div><code>'+escape(from)+'</code><span aria-hidden="true">→</span><span>'+escape(to)+'</span></div>').join('')+'</div><h4>Target inherent capability</h4>'+button('capability',c.id,c.name,c.provider)+'</div>';
  }
  if(s.type==='app'){
   const a=m.applications.find(x=>x.id===s.id);
   const ws=m.workflows.filter(w=>this.eligible(w)&&w.steps.some(step=>cap(m,step.capability)?.provider===s.id));
   const cs=m.capabilities.filter(c=>c.provider===s.id);
   return '<div class="map-inspect"><div class="map-inspect-top"><div><span class="meta">APPLICATION</span><h3>'+escape(a.name)+'</h3><p>'+escape(a.description)+'</p></div>'+button('application',a.id,'Open application','Full capability and source profile')+'</div>'+
   '<h4>Inherent capabilities ('+cs.length+')</h4><div class="map-inspect-list">'+cs.map(c=>button('capability',c.id,c.name,c.id)).join('')+'</div>'+
   '<h4>External entity mapping examples ('+this.shownMappings().filter(x=>x.targetApp===s.id).length+')</h4><div class="map-inspect-list">'+this.shownMappings().filter(x=>x.targetApp===s.id).map(x=>'<button class="map-link" data-map-source="'+escape(x.id)+'"><span><strong>'+escape(x.name)+'</strong><small>'+escape(x.entityClass)+' · Illustrative</small></span><span>›</span></button>').join('')+'</div>'+
   '<h4>Participating workflows ('+ws.length+')</h4><div class="map-inspect-list">'+ws.map(w=>button('workflow',w.id,w.name,w.status==='planned'?'Planned':'Established')).join('')+'</div></div>';
  }
  if(s.type==='pair'){
   const p=this.shownPairs().find(x=>x.id===s.id);
   if(!p)return '<div class="map-inspect"><p>No visible workflows for this relationship.</p></div>';
   return '<div class="map-inspect"><span class="meta">WORKFLOW-DERIVED RELATIONSHIP</span><h3>'+escape(p.from)+' ↔ '+escape(p.to)+'</h3><p>The following workflows involve both applications. This is not a separately maintained integration.</p><div class="map-inspect-list">'+p.workflows.map(w=>button('workflow',w.id,w.name,w.status==='planned'?'Planned':'Established')).join('')+'</div></div>';
  }
  const w=m.workflows.find(x=>x.id===s.id);
  if(!w)return '';
  return '<div class="map-inspect"><span class="meta">CAPABILITY WORKFLOW</span><h3>'+escape(w.name)+'</h3><p>'+escape(w.summary)+'</p><div class="map-step-list">'+w.steps.map((s,i)=>{const c=cap(m,s.capability);return '<div><span class="map-step-index">'+(i+1)+'</span>'+button('capability',c.id,c.name,c.provider)+'</div>'}).join('')+'</div>'+button('workflow',w.id,'Open full workflow','Review sequence and API contracts')+'</div>';
 }
 render(){
  const available=this.shownPairs(),sources=this.shownMappings();
  const filtersActive=!!this.filters.search||this.filters.status&&this.filters.status!=='all';
  const active=this.selection,classes=[...new Set((this.model.externalMappings||[]).map(x=>x.entityClass))];
  const header='<div class="map-header"><div><h2>Integration map</h2><p class="sub">One explorable view of application workflows and illustrative external entity classes.</p></div><div class="map-tools">'+
  '<button aria-label="Zoom out" data-map-action="zoom-out">−</button><button aria-label="Reset zoom" data-map-action="zoom-reset">Fit</button><button aria-label="Zoom in" data-map-action="zoom-in">+</button>'+
  '<button class="map-clear" data-map-action="clear" '+(!active?'disabled':'')+'>Clear focus</button></div></div>';
  const check=(key,label)=>'<label class="map-toggle"><input type="checkbox" data-map-filter="'+key+'" '+(this.layers[key]?'checked':'')+'>'+label+'</label>';
  const filters='<div class="map-layers"><div class="map-filter-label">SHOW ON MAP</div>'+check('workflows','Workflow connections')+check('external','External entity mappings')+check('planned','Planned components')+check('standard','Design standard')+
   '<label class="map-class-filter">Entity class <select data-map-class '+(!this.layers.external?'disabled':'')+'><option value="all">All classes</option>'+classes.map(x=>'<option value="'+escape(x)+'" '+(this.entityClass===x?'selected':'')+'>'+escape(x)+'</option>').join('')+'</select></label></div>';
  this.root.innerHTML=header+filters+this.visual()+'<div class="map-key"><span><i class="map-key-line"></i>Workflow</span><span><i class="map-key-line planned"></i>Planned only</span><span><i class="map-key-line source"></i>Illustrative external mapping</span><span>'+available.length+' workflow relationships · '+sources.length+' mapping examples'+(filtersActive?' (filtered)':'')+'</span></div>'+this.detail();
 }

 }
window.OneVisionIntegrationMap=IntegrationMap;
})();