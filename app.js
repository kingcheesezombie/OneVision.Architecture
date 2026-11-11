(()=>{
'use strict';
const $=id=>document.getElementById(id);
const state={model:null,view:'landscape',kind:null,id:null,search:'',status:'all'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=id=>state.model.applications.find(a=>a.id===id);
const cap=id=>state.model.capabilities.find(c=>c.id===id);
const ep=id=>state.model.endpoints.find(e=>e.id===id);
const workflowsForApp=id=>state.model.workflows.filter(w=>w.steps.some(s=>cap(s.capability)?.provider===id));
const workflowsForCap=id=>state.model.workflows.filter(w=>w.steps.some(s=>s.capability===id));
const kinds={application:'applications',capability:'capabilities',workflow:'workflows'};
const singular={applications:'application',capabilities:'capability',workflows:'workflow'};
const plural={landscape:'Landscape',applications:'Applications',capabilities:'Capabilities',workflows:'Workflows'};
const collection=view=>view==='applications'?state.model.applications:view==='capabilities'?state.model.capabilities:view==='workflows'?state.model.workflows:[];
const label=(kind,id)=>kind==='application'?app(id)?.name:kind==='capability'?cap(id)?.name:state.model.workflows.find(w=>w.id===id)?.name;
const statusBadge=s=>'<span class="pill '+(s==='planned'?'planned':'')+'">'+(s==='planned'?'Planned':'Established')+'</span>';
const item=(kind,id,title,meta,desc,status)=>'<button class="item" data-kind="'+kind+'" data-id="'+esc(id)+'"><span class="meta">'+esc(meta)+'</span><strong>'+esc(title)+'</strong>'+(desc?'<p>'+esc(desc)+'</p>':'')+(status?statusBadge(status):'')+'</button>';
function nav(view,kind=null,id=null){
 state.view=view;state.kind=kind;state.id=id;state.search='';$('search').value='';$('status').value='all';state.status='all';
 const hash=kind?'#'+view+'/'+encodeURIComponent(id):'#'+view;
 if(location.hash!==hash)history.pushState(null,'',hash);
 render();window.scrollTo(0,0);
}
function fromHash(){
 const [view,raw]=decodeURIComponent(location.hash.slice(1)).split('/');
 const valid=['landscape','applications','capabilities','workflows'].includes(view)?view:'landscape';
 const kind=singular[valid]||null;
 const obj=raw?collection(valid).find(x=>x.id===raw):null;
 state.view=valid;state.kind=obj?kind:null;state.id=obj?obj.id:null;
 render();
}
function criteria(v){return (state.status==='all'||(v.status||'established')===state.status)&&(!state.search||[v.name,v.tagline,v.summary,v.description,v.nature,v.provider,v.id].filter(Boolean).join(' ').toLowerCase().includes(state.search));}
function renderSidebar(){
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false')});
 $('browse-name').textContent=state.view==='landscape'?'':plural[state.view];
 const browse=$('browse');
 if(state.view==='landscape'){browse.innerHTML='<p class="browse-hint">Select an application or workflow to explore it in full.</p>';return}
 const group=collection(state.view);
 let out='';
 if(state.kind)out+='<button class="browse-back" data-list="'+state.view+'">← All '+esc(plural[state.view])+'</button>';
 if(state.view==='capabilities'){
  for(const a of state.model.applications){
   const items=group.filter(c=>c.provider===a.id);
   if(!items.length)continue;
   out+='<div class="browse-group">'+esc(a.id)+'</div>'+items.map(c=>sidebarItem('capability',c)).join('');
  }
 }else out=out+group.map(x=>sidebarItem(singular[state.view],x)).join('');
 browse.innerHTML=out;
}
function sidebarItem(kind,x){
 return '<button class="browse-item '+(state.kind===kind&&state.id===x.id?'selected':'')+'" data-kind="'+kind+'" data-id="'+esc(x.id)+'" '+(state.kind===kind&&state.id===x.id?'aria-current="page"':'')+'>'+esc(x.name)+'</button>';
}
function setHeader(title,subtitle){$('heading').textContent=title;$('intro').textContent=subtitle;$('section-name').textContent=plural[state.view].toUpperCase()}
function viewCard(kind,x){
 return item(kind,x.id,x.name,kind==='application'?x.tagline:kind==='capability'?x.provider:x.participants.join(' + '),x.description||x.summary,x.status);
}
function renderList(){
 $('toolbar').hidden=false;
 setHeader(plural[state.view],state.view==='applications'?'What each application owns and how it connects.':state.view==='capabilities'?'Reusable functions owned by individual applications.':'Functional outcomes assembled from named capabilities.');
 const list=collection(state.view).filter(criteria);
 const description=state.view==='workflows'?'Select a workflow to see its complete capability sequence and API contracts.':'Select one item to open its full documentation.';
 $('content').innerHTML='<div class="panel"><h2>Browse '+esc(plural[state.view])+'</h2><p class="sub">'+description+'</p><div class="items">'+list.map(x=>viewCard(singular[state.view],x)).join('')+'</div>'+(list.length?'':'<p>No matches.</p>')+'</div>';
}
function linked(kind,id,title,context){return '<button class="link-row" data-kind="'+kind+'" data-id="'+esc(id)+'"><span><strong>'+esc(title)+'</strong>'+(context?'<small>'+esc(context)+'</small>':'')+'</span><span class="link-arrow">›</span></button>'}
function section(title,body){return '<section class="panel detail-section"><h2>'+esc(title)+'</h2>'+body+'</section>'}
function applicationDetail(a){
 setHeader(a.name,a.description);const cs=state.model.capabilities.filter(c=>c.provider===a.id),ws=workflowsForApp(a.id);
 let html='<div class="detail-lead"><span class="meta">'+esc(a.tagline)+'</span>'+statusBadge(a.status)+'</div>';
 html+=section('Application purpose','<p>'+esc(a.nature||a.description)+'</p><p>'+esc(a.connectionRole||'')+'</p>');
 const src=a.sourceConfiguration||[];
 html+=section('Source configuration capabilities',src.length?'<div class="detail-grid">'+src.map(s=>'<div class="source-profile"><strong>'+esc(s.type)+'</strong><p>'+esc(s.purpose)+'</p><span class="meta">'+esc(s.detail)+'</span></div>').join('')+'</div>':'<p class="muted">No source configuration capability documented.</p>');
 html+=section('Inherent capabilities',cs.length?cs.map(c=>linked('capability',c.id,c.name,c.summary)).join(''):'<p class="muted">No capabilities documented.</p>');
 html+=section('Participating workflows',ws.length?ws.map(w=>linked('workflow',w.id,w.name,w.status==='planned'?'Planned':'Established')).join(''):'<p class="muted">No workflows documented.</p>');
 return html;
}
function capabilityDetail(c){
 setHeader(c.name,c.summary);
 const ws=workflowsForCap(c.id);
 let html='<div class="detail-lead"><span class="meta">CANONICAL CAPABILITY · '+esc(c.id)+'</span>'+statusBadge(c.status)+'</div>';
 html+=section('Capability definition','<p>'+esc(c.summary)+'</p><div class="fact"><span>Owned by</span>'+linked('application',c.provider,app(c.provider)?.name||c.provider,c.provider)+'</div><div class="fact"><span>Classification</span><p>'+esc((c.tags||[]).join(' · '))+'</p></div>');
 html+=section('Used in workflows',ws.length?ws.map(w=>linked('workflow',w.id,w.name,w.summary)).join(''):'<p class="muted">Not yet referenced in a workflow.</p>');
 return html;
}
function contract(s){
 const c=s.connection||{kind:'unspecified',endpointIds:[]};
 const label=c.kind==='internal'?'Internal application capability':c.kind==='api-handler'?'Receiving API handler':c.kind==='api'?'API invocation':'Contract not yet specified';
 let h='<div class="contract"><h3>'+esc(label)+'</h3>';
 for(const id of c.endpointIds||[]){const e=ep(id);if(!e)continue;h+='<div class="endpoint"><span class="http-method">'+esc(e.method)+'</span> <code>'+esc(e.path)+'</code><p>'+esc(e.purpose)+'</p><span class="meta">Owned by '+esc(e.owner)+'</span></div>'}
 if(c.note)h+='<p class="contract-note">'+esc(c.note)+'</p>';
 return h+'</div>';
}
function workflowDetail(w){
 setHeader(w.name,w.summary);
 let h='<div class="detail-lead"><span class="meta">CAPABILITY WORKFLOW · '+esc(w.participants.join(' + '))+'</span>'+statusBadge(w.status)+'</div>';
 h+=section('Functional sequence','<p class="muted">Each step reuses its owning application’s canonical capability. API information documents the interaction, not deployment configuration.</p><div class="workflow-steps">'+w.steps.map((s,i)=>{const c=cap(s.capability);return '<div class="workflow-step"><div class="step-number">'+(i+1)+'</div><div class="workflow-body"><div class="step-box"><span class="step-provider">'+esc(c.provider)+' · '+esc(c.id)+'</span>'+linked('capability',c.id,c.name,c.summary)+'</div>'+contract(s)+'</div></div>'}).join('')+'</div>');
 h+=section('Participating applications',w.participants.map(id=>linked('application',id,app(id)?.name||id,app(id)?.tagline)).join(''));
 return h;
}
const scriptPanel=new window.ArchitectureScriptPanel();
const properties=new window.ArchitectureProperties();
function renderLandscape(){
 $('toolbar').hidden=false;
 setHeader('Integration landscape','Select any application, external entity or connection line to inspect properties on the right. Edit approved link capabilities and entity mappings through the panel.');
 $('content').innerHTML='<section class="panel integration-map-panel"><div class="architecture-workbench"><div class="architecture-map-column"><div id="integration-map"></div><aside id="architecture-properties" class="architecture-properties" aria-label="Architecture visual properties"></aside></div><details class="architecture-script-expander"><summary><span class="script-expander-title">Architecture scripts <small>Generated YAML · Advanced editor</small></span><span class="script-expander-chevron" aria-hidden="true">⌄</span></summary><div id="architecture-script-panel" class="architecture-script-panel" aria-label="Architecture YAML script editor"></div></details></div></section>';
 const map=new window.OneVisionIntegrationMap($('integration-map'),state.model,(kind,id)=>nav(kinds[kind],kind,id),{status:state.status,search:state.search});
 scriptPanel.mount($('architecture-script-panel'),map);
 properties.mount($('architecture-properties'),map,scriptPanel);
 map.onSelect=selection=>properties.select(selection);
 properties.ready();
}

function render(){
 if(!state.model)return;
 renderSidebar();$('updated').textContent='Updated '+state.model.updated;
 if(state.view==='landscape'){renderLandscape();return}
 if(!state.kind){renderList();return}
 $('toolbar').hidden=true;
 const target=collection(state.view).find(x=>x.id===state.id);
 if(!target){state.kind=null;state.id=null;renderList();return}
 const breadcrumb='<button class="crumb" data-list="'+state.view+'">← '+esc(plural[state.view])+'</button>';
 const body=state.kind==='application'?applicationDetail(target):state.kind==='capability'?capabilityDetail(target):workflowDetail(target);
 $('content').innerHTML=breadcrumb+'<div class="focused-detail">'+body+'</div>';
}
document.addEventListener('click',e=>{
 const section=e.target.closest('[data-view]');if(section){nav(section.dataset.view);return}
 const back=e.target.closest('[data-list]');if(back){nav(back.dataset.list);return}
 const link=e.target.closest('[data-kind]');if(link){nav(kinds[link.dataset.kind],link.dataset.kind,link.dataset.id)}
});
$('search').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();render()});
$('status').addEventListener('change',e=>{state.status=e.target.value;render()});
window.addEventListener('popstate',fromHash);
window.addEventListener('hashchange',fromHash);
fetch('data/architecture.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(m=>{
 const cs=new Map(m.capabilities.map(c=>[c.id,c])),es=new Set(m.endpoints.map(e=>e.id));
 for(const w of m.workflows)for(const s of w.steps){if(!cs.has(s.capability))throw Error('Unknown capability '+s.capability);if(s.description)throw Error('Duplicate capability description '+s.id);for(const id of s.connection?.endpointIds||[])if(!es.has(id))throw Error('Unknown endpoint '+id)}
 state.model=m;fromHash();
}).catch(e=>{$('content').innerHTML='<div class="panel">Unable to load architecture: '+esc(e.message)+'</div>'});
})();