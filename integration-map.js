(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap=(m,id)=>m.capabilities.find(c=>c.id===id);
const actions=(kind,id,title,sub)=>'<button class="map-link" data-kind="'+kind+'" data-id="'+esc(id)+'"><span><strong>'+esc(title)+'</strong>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span><span aria-hidden="true">›</span></button>';
// Presentation coordinates and attachment points only. Relationships always come from the YAML-generated model.
const layouts={
 IDM:{x:485,y:225},EAM:{x:890,y:225},HDM:{x:485,y:580},ODM:{x:890,y:580},
 KPI:{x:485,y:850},ONEVISION:{x:1310,y:530},UI:{x:1300,y:840}
};
const sourcePosition={
 "EXT-IDM-PERSON":{x:155,y:146,side:'right',port:'left'},
 "EXT-IDM-EPISODE":{x:155,y:220,side:'right',port:'left'},
 "EXT-EAM-ASSET":{x:820,y:46,side:'bottom',port:'top'},
 "EXT-EAM-ATTRIBUTE":{x:1005,y:46,side:'bottom',port:'top'},
 "EXT-HDM-HIER":{x:155,y:580,side:'right',port:'left'},
 "EXT-ODM-UNIT":{x:890,y:410,side:'bottom',port:'top'},
 "EXT-KPI-VALUE":{x:155,y:850,side:'right',port:'left'}
};
const W=166,H=80,SW=178,SH=60;
const offsets={top:[0,-H/2],bottom:[0,H/2],left:[-W/2,0],right:[W/2,0]};
const srcOffsets={top:[0,-SH/2],bottom:[0,SH/2],left:[-SW/2,0],right:[SW/2,0]};
const svgPort=(x,y,tone)=>'<circle class="arch-port '+tone+'" cx="'+x+'" cy="'+y+'" r="6"/>';
const appPort=(id,side)=>{const a=layouts[id],d=offsets[side];return [a.x+d[0],a.y+d[1]]};
function edgesFromWorkflows(workflows,model){
 const edges=new Map();
 for(const w of workflows){
  const steps=new Map(w.steps.map(s=>[s.id,s]));
  for(const step of w.steps){
   const from=cap(model,step.capability)?.provider;
   for(const nextId of step.next||[]){
    const to=cap(model,steps.get(nextId)?.capability)?.provider;
    if(!from||!to||from===to)continue;
    const key=[from,to].sort().join('|');
    if(!edges.has(key))edges.set(key,{id:key,from,to,workflows:[]});
    if(!edges.get(key).workflows.some(x=>x.id===w.id))edges.get(key).workflows.push(w);
   }
  }
 }
 return [...edges.values()];
}
class IntegrationMap{
 constructor(root,model,navigate,filters={}){
  this.root=root;this.model=model;this.navigate=navigate;this.filters=filters;this.selection=null;this.zoom=1;
  this.layers={workflows:true,external:true,planned:false,standard:true};
  this.entityClass='all';
  root.addEventListener('click',e=>{
   const el=e.target.closest('[data-map-action],[data-kind],[data-map-app],[data-map-source],[data-map-edge]');
   if(el){e.stopPropagation();this.click(el)}
  });
  root.addEventListener('keydown',e=>{
   if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-map-app],[data-map-source],[data-map-edge]')){
    e.preventDefault();this.click(e.target.closest('[data-map-app],[data-map-source],[data-map-edge]'));
   }
  });
  root.addEventListener('change',e=>{
   const layer=e.target.closest('[data-map-filter]');if(layer){this.layers[layer.dataset.mapFilter]=layer.checked;this.render();return}
   const field=e.target.closest('[data-map-class]');if(field){this.entityClass=field.value;this.render()}
  });
  this.render();
 }
 click(el){
  const a=el.dataset.mapAction;
  if(a==='clear')this.selection=null;
  else if(a==='zoom-in')this.zoom=Math.min(1.6,this.zoom+.15);
  else if(a==='zoom-out')this.zoom=Math.max(1,this.zoom-.15);
  else if(a==='zoom-reset')this.zoom=1;
  else if(el.dataset.kind){this.navigate(el.dataset.kind,el.dataset.id);return}
  else if(el.dataset.mapApp)this.selection={type:'app',id:el.dataset.mapApp};
  else if(el.dataset.mapSource)this.selection={type:'source',id:el.dataset.mapSource};
  else if(el.dataset.mapEdge)this.selection={type:'edge',id:el.dataset.mapEdge};
  this.render();
 }
 relevant(w){
  if(!this.layers.planned&&w.status==='planned')return false;
  if(this.filters.status&&this.filters.status!=='all'&&w.status!==this.filters.status)return false;
  const q=(this.filters.search||'').trim().toLowerCase();
  if(!q)return true;
  return [w.id,w.name,w.summary,...w.steps.map(s=>{const c=cap(this.model,s.capability);return [c?.name,c?.provider,c?.summary].join(' ')})].join(' ').toLowerCase().includes(q);
 }
 workflows(){return this.layers.workflows?this.model.workflows.filter(w=>this.relevant(w)):[]}
 sources(){
  if(!this.layers.external)return [];
  const q=(this.filters.search||'').trim().toLowerCase();
  return (this.model.externalMappings||[]).filter(s=>this.entityClass==='all'||s.entityClass===this.entityClass).filter(s=>!q||[s.name,s.entityClass,s.sourceExample,s.targetApp,...s.fields.flat()].join(' ').toLowerCase().includes(q));
 }
 apps(){return this.model.applications.filter(a=>(this.layers.planned||a.status!=='planned'||a.id==='ONEVISION')&&(this.layers.standard||a.id!=='UI')).filter(a=>layouts[a.id])}
 edges(){return edgesFromWorkflows(this.workflows(),this.model)}
 isFocused(id){
  if(!this.selection)return true;
  const s=this.selection;
  if(s.type==='app')return s.id===id;
  if(s.type==='source')return this.model.externalMappings.find(x=>x.id===s.id)?.targetApp===id;
  if(s.type==='edge')return s.id.split('|').includes(id);
  return true;
 }
 // Explicit routing is about visual clarity; the endpoint pair still derives only from workflow steps.
 route(a,b){
  const pair=[a,b].sort().join('|');
  const directions={
   'EAM|IDM':{EAM:'left',IDM:'right'},
   'EAM|HDM':{EAM:'bottom',HDM:'right'},
   'HDM|ODM':{HDM:'right',ODM:'left'},
   'IDM|ONEVISION':{IDM:'top',ONEVISION:'top'},
   'EAM|ONEVISION':{EAM:'right',ONEVISION:'top'},
   'HDM|ONEVISION':{HDM:'bottom',ONEVISION:'bottom'},
   'KPI|ONEVISION':{KPI:'right',ONEVISION:'bottom'}
  };
  const sides=directions[pair]||{};
  const [sa,sb]=[sides[a]||'right',sides[b]||'left'];
  const [ax,ay]=appPort(a,sa),[bx,by]=appPort(b,sb);
  let d='M '+ax+' '+ay;
  if(pair==='EAM|IDM'||pair==='HDM|ODM')d+=' L '+bx+' '+by;
  else if(pair==='EAM|HDM'){
   // Quiet diagonal corridor between the two application rows.
   d+=' C '+ax+' '+(ay+110)+', '+(bx+130)+' '+(by-80)+', '+bx+' '+by;
  }else if(pair==='IDM|ONEVISION'){
   d+=' C '+ax+' 85, 1230 85, 1230 380 L '+bx+' '+by;
  }else if(pair==='EAM|ONEVISION'){
   d+=' C 1120 '+ay+', 1110 '+by+', '+bx+' '+by;
  }else if(pair==='HDM|ONEVISION'){
   d+=' C '+ax+' 950, 1170 960, '+bx+' '+by;
  }else if(pair==='KPI|ONEVISION'){
   d+=' C 890 '+ay+', 1170 895, '+bx+' '+by;
  }else d+=' C '+(ax+bx)/2+' '+ay+', '+(ax+bx)/2+' '+by+', '+bx+' '+by;
  return {d,start:[ax,ay],end:[bx,by]};
 }
 diagram(){
  const edges=this.edges(),sources=this.sources(),apps=this.apps();
  const view=[(1500-1500/this.zoom)/2,(1020-1020/this.zoom)/2,1500/this.zoom,1020/this.zoom].join(' ');
  let svg='<svg class="architecture-svg" viewBox="'+view+'" role="group" aria-label="OneVision helicopter architecture map with explicit connection points">'+
    '<defs><marker id="arch-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L9 4.5 L0 9z" fill="#397da9"/></marker><marker id="arch-planned-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L9 4.5 L0 9z" fill="#c39b54"/></marker><marker id="arch-source-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L8 4 L0 8z" fill="#a47ebc"/></marker></defs>';
  // Paths first, nodes last; node fills mask passing lines and all attachments show explicit ports.
  svg+='<g class="arch-workflow-paths">'+edges.map(edge=>{
   const {from,to,workflows}=edge,planned=workflows.every(w=>w.status==='planned'),route=this.route(from,to),focused=!this.selection||this.selection.type==='edge'&&this.selection.id===edge.id||this.selection.type==='app'&&[from,to].includes(this.selection.id);
   return '<g data-map-edge="'+esc(edge.id)+'" tabindex="0" role="button" aria-label="'+esc(workflows.map(w=>w.name).join(', '))+'" class="arch-connection '+(planned?'is-planned ':'')+(focused?'':'dimmed')+'"><path class="arch-path-hit" d="'+route.d+'"/><path class="arch-path-line" d="'+route.d+'" marker-end="url(#'+(planned?'arch-planned-arrow':'arch-arrow')+')"/>'+
    svgPort(...route.start,planned?'gold':'blue')+svgPort(...route.end,planned?'gold':'blue')+'</g>';
  }).join('')+'</g>';
  svg+='<g class="arch-source-paths">'+sources.map(s=>{
   const loc=sourcePosition[s.id],dest=layouts[s.targetApp];if(!loc||!dest)return '';
   const off=srcOffsets[loc.side],left=[loc.x+off[0],loc.y+off[1]],right=appPort(s.targetApp,loc.port);
   if(s.id==='EXT-IDM-PERSON')right[1]-=16;
   if(s.id==='EXT-IDM-EPISODE')right[1]+=16;
   if(s.id==='EXT-EAM-ASSET')right[0]-=28;
   if(s.id==='EXT-EAM-ATTRIBUTE')right[0]+=28;
   const dx=right[0]-left[0],dy=right[1]-left[1];
   // Route from the nearest edge, without running across unrelated boxes.
   const d=loc.side==='bottom'?'M '+left[0]+' '+left[1]+' C '+left[0]+' '+(left[1]+Math.max(25,dy*.5))+' '+right[0]+' '+(right[1]-35)+' '+right[0]+' '+right[1]:
    'M '+left[0]+' '+left[1]+' C '+(left[0]+Math.max(34,dx*.5))+' '+left[1]+' '+(right[0]-42)+' '+right[1]+' '+right[0]+' '+right[1];
   const focus=!this.selection||this.selection.id===s.id||this.selection.type==='app'&&this.selection.id===s.targetApp;
   return '<g class="arch-external-edge '+(focus?'':'dimmed')+'" data-map-source="'+esc(s.id)+'"><path class="arch-path-hit" d="'+d+'"/><path class="arch-source-path" d="'+d+'" marker-end="url(#arch-source-arrow)"/>'+svgPort(...left,'purple')+svgPort(...right,'purple')+'</g>';
  }).join('')+'</g>';
  svg+='<g class="arch-application-nodes">'+apps.map(a=>{
   const p=layouts[a.id],selected=this.selection?.type==='app'&&this.selection.id===a.id;
   return '<g class="arch-app '+(a.status==='planned'?'planned ':'')+(a.id==='UI'?'standard ':'')+(selected?'selected ':'')+(this.isFocused(a.id)?'':'dimmed')+'" data-map-app="'+esc(a.id)+'" tabindex="0" role="button" aria-label="Explore '+esc(a.name)+'"><rect x="'+(p.x-W/2)+'" y="'+(p.y-H/2)+'" width="'+W+'" height="'+H+'" rx="13"/><text class="arch-app-name" x="'+p.x+'" y="'+(p.y-4)+'" text-anchor="middle">'+esc(a.id==='ONEVISION'?'OneVision':a.id==='UI'?'OneVision.UI':a.id)+'</text><text class="arch-app-sub" x="'+p.x+'" y="'+(p.y+20)+'" text-anchor="middle">'+esc(a.tagline)+'</text></g>';
  }).join('')+'</g>';
  svg+='<g class="arch-external-nodes">'+sources.map(s=>{
   const p=sourcePosition[s.id];if(!p)return '';
   const focus=!this.selection||this.selection.id===s.id||this.selection.type==='app'&&this.selection.id===s.targetApp;
   return '<g class="arch-external-node '+(this.selection?.id===s.id?'selected ':'')+(focus?'':'dimmed')+'" data-map-source="'+esc(s.id)+'" tabindex="0" role="button" aria-label="'+esc(s.name+' example into '+s.targetApp)+'"><rect x="'+(p.x-SW/2)+'" y="'+(p.y-SH/2)+'" width="'+SW+'" height="'+SH+'" rx="9"/><text class="arch-external-name" x="'+p.x+'" y="'+(p.y-3)+'" text-anchor="middle">'+esc(s.name)+'</text><text class="arch-external-sub" x="'+p.x+'" y="'+(p.y+15)+'" text-anchor="middle">'+esc(s.entityClass+' · example')+'</text></g>';
  }).join('')+'</g></svg>';
  return '<div class="arch-stage">'+svg+'</div>';
 }
 details(){
  const s=this.selection,m=this.model;
  if(!s)return '<div class="map-inspect"><strong>Explore the architecture</strong><p>Select an application, external source or workflow connection to inspect it. Circular ports show exactly where each line attaches. Planned relationships are optional and separate from established integrations.</p></div>';
  if(s.type==='source'){
   const x=m.externalMappings.find(y=>y.id===s.id);if(!x)return '';
   const c=cap(m,x.targetCapability);
   return '<div class="map-inspect"><span class="meta">ILLUSTRATIVE EXTERNAL MAPPING</span><h3>'+esc(x.name)+' → '+esc(x.targetApp)+'</h3><p>'+esc(x.description)+'</p><p><strong>Example source:</strong> '+esc(x.sourceExample)+'</p><h4>Example field mappings</h4><div class="map-field-grid">'+x.fields.map(([from,to])=>'<div><code>'+esc(from)+'</code><span>→</span><span>'+esc(to)+'</span></div>').join('')+'</div><h4>Target capability</h4>'+actions('capability',c.id,c.name,c.provider)+'</div>';
  }
  if(s.type==='app'){
   const a=m.applications.find(x=>x.id===s.id),cs=m.capabilities.filter(c=>c.provider===s.id),ws=this.workflows().filter(w=>w.participants.includes(s.id)),ex=this.sources().filter(x=>x.targetApp===s.id);
   return '<div class="map-inspect"><span class="meta">APPLICATION</span><h3>'+esc(a.name)+'</h3><p>'+esc(a.description)+'</p>'+actions('application',a.id,'Open application details','Sources and capabilities')+'<h4>External mappings ('+ex.length+')</h4><div class="map-inspect-list">'+ex.map(x=>'<button class="map-link" data-map-source="'+esc(x.id)+'"><span><strong>'+esc(x.name)+'</strong><small>'+esc(x.entityClass)+' · Example</small></span><span>›</span></button>').join('')+'</div><h4>Capabilities ('+cs.length+')</h4><div class="map-inspect-list">'+cs.map(c=>actions('capability',c.id,c.name,c.id)).join('')+'</div><h4>Workflows ('+ws.length+')</h4><div class="map-inspect-list">'+ws.map(w=>actions('workflow',w.id,w.name,w.status)).join('')+'</div></div>';
  }
  const edge=this.edges().find(x=>x.id===s.id);
  if(!edge)return '<div class="map-inspect">No workflows visible for this relationship.</div>';
  return '<div class="map-inspect"><span class="meta">WORKFLOW-DERIVED RELATIONSHIP</span><h3>'+esc(edge.from)+' ↔ '+esc(edge.to)+'</h3><p>Relationship derived from successive capabilities owned by these applications, not from a manually drawn connection.</p><div class="map-inspect-list">'+edge.workflows.map(w=>actions('workflow',w.id,w.name,w.status)).join('')+'</div></div>';
 }
 render(){
  const classes=[...new Set((this.model.externalMappings||[]).map(x=>x.entityClass))];
  const check=(key,label)=>'<label class="map-toggle"><input type="checkbox" data-map-filter="'+key+'" '+(this.layers[key]?'checked':'')+'>'+label+'</label>';
  const header='<div class="map-header"><div><h2>Architecture helicopter view</h2><p class="sub">Applications, source classes and workflow-derived relationships on one navigable map.</p></div><div class="map-tools"><button data-map-action="zoom-out" aria-label="Zoom out">−</button><button data-map-action="zoom-reset">Fit</button><button data-map-action="zoom-in" aria-label="Zoom in">+</button><button class="map-clear" data-map-action="clear" '+(!this.selection?'disabled':'')+'>Clear focus</button></div></div>';
  const filters='<div class="map-layers"><div class="map-filter-label">SHOW ON MAP</div>'+check('workflows','Workflow connections')+check('external','External mappings')+check('planned','Planned relationships')+check('standard','UI standard')+'<label class="map-class-filter">Entity class <select data-map-class '+(!this.layers.external?'disabled':'')+'><option value="all">All classes</option>'+classes.map(x=>'<option value="'+esc(x)+'" '+(this.entityClass===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label></div>';
  this.root.innerHTML=header+filters+this.diagram()+'<div class="map-key"><span><i class="map-key-line"></i>Established workflow</span><span><i class="map-key-line source"></i>External mapping example</span><span><i class="map-key-line planned"></i>Planned workflow</span><span>'+this.edges().length+' relationships · '+this.sources().length+' source mappings</span></div>'+this.details();
 }
}
window.OneVisionIntegrationMap=IntegrationMap;
})();