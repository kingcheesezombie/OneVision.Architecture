(()=>{'use strict';
const $=id=>document.getElementById(id);
const state={view:'landscape',search:'',status:'all',model:null};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=id=>state.model.applications.find(a=>a.id===id);
const cap=id=>state.model.capabilities.find(c=>c.id===id);
const ep=id=>(state.model.endpoints||[]).find(e=>e.id===id);
const endpointList=ids=>(ids||[]).map(id=>{const e=ep(id);return e?'<div class="endpoint"><span class="http-method">'+escape(e.method)+'</span> <code>'+escape(e.path)+'</code><p>'+escape(e.purpose)+'</p><span class="meta">'+escape(e.owner)+' · '+escape(e.status)+'</span></div>':''}).join('');
const connectionMarkup=s=>{const x=s.connection||{kind:'unspecified',endpointIds:[]};return '<div class="step-contract"><span class="meta">'+escape(x.kind==='internal'?'INTERNAL CAPABILITY':x.kind==='api-handler'?'RECEIVING API HANDLER':x.kind==='api'?'API CONTRACT':'CONTRACT UNDOCUMENTED')+'</span>'+endpointList(x.endpointIds)+(x.note?'<p class="contract-note">'+escape(x.note)+'</p>':'')+'</div>'};
const textItems=items=>items?.length?'<ul class="compact-list">'+items.map(x=>'<li>'+escape(x)+'</li>').join('')+'</ul>':'<p class="meta">Not applicable or not yet documented.</p>';

const relationships=()=>{const out=new Map();for(const w of state.model.workflows){const owners=[...new Set(w.steps.map(s=>cap(s.capability)?.provider).filter(Boolean))];for(let i=0;i<owners.length;i++)for(let j=i+1;j<owners.length;j++){const a=owners[i],b=owners[j],k=[a,b].sort().join('|');const v=out.get(k)||{a,b,workflows:[]};v.workflows.push(w);out.set(k,v)}}return [...out.values()]};
const appWorkflows=id=>state.model.workflows.filter(w=>w.steps.some(s=>cap(s.capability)?.provider===id));
const capWorkflows=id=>state.model.workflows.filter(w=>w.steps.some(s=>s.capability===id));
const workflowMatches=w=>matches([w.name,w.summary,...w.steps.map(s=>{const c=cap(s.capability);return [c?.name,c?.summary,c?.provider,...(s.connection?.endpointIds||[]).map(id=>ep(id)?.path)].join(' ')})].join(' '))&&(state.status==='all'||w.status===state.status);
const matches=s=>!state.search||s.toLowerCase().includes(state.search);

const badge=status=>'<span class="pill '+(status==='planned'?'planned':'')+'">'+(status==='planned'?'Planned':'Established')+'</span>';

const setHeading=(h,d)=>{$('heading').textContent=h;$('intro').textContent=d};
function card(title,subtitle,type,id,status){return '<button class="item" data-kind="'+type+'" data-id="'+escape(id)+'"><div class="meta">'+escape(subtitle)+'</div><strong>'+escape(title)+'</strong>'+(status?badge(status):'')+'</button>'}
function renderLandscape(){
 setHeading('Application landscape','Explore applications and their workflow-derived relationships.');
 const apps=state.model.applications.filter(a=>matches([a.id,a.name,a.tagline,a.description].join(' ')));
 let html='<div class="panel"><h2>The OneVision ecosystem</h2><p class="sub">Select an application to explore its responsibilities, inherent capabilities and workflows.</p><div class="landscape">';
 for(const a of apps)html+='<button class="node '+(a.group==='hub'?'hub':a.group==='standard'?'standard':a.group==='supporting'?'supporting':'')+'" data-kind="application" data-id="'+escape(a.id)+'"><strong>'+escape(a.id==='ONEVISION'?'OneVision':a.id==='UI'?'OneVision.UI':a.id)+'</strong><span>'+escape(a.tagline)+'</span><small>'+escape(a.description)+'</small></button>';
 html+='</div><div class="hint">Application relationships come from workflows; the design system is a cross-cutting standard rather than a runtime connection.</div></div>';
 const list=relationships().map(rel=>({...rel,workflows:rel.workflows.filter(workflowMatches)})).filter(rel=>rel.workflows.length);
 html+='<div class="sectiontitle">Workflow-derived relationships ('+list.length+')</div><div class="connections">';
 for(const rel of list)html+='<div class="item"><div class="flowline"><span class="chip">'+escape(rel.a)+'</span><span class="arrow">↔</span><span class="chip">'+escape(rel.b)+'</span></div><strong>'+rel.workflows.length+' workflow'+(rel.workflows.length===1?'':'s')+'</strong>'+rel.workflows.map(w=>card(w.name,w.status==='planned'?'Planned workflow':'Capability workflow','workflow',w.id,w.status)).join('')+'</div>';
 html+='</div>';$('content').innerHTML=html;
}
function renderApplications(){
 setHeading('Applications','Application responsibilities, source configuration and inherent capabilities.');
 const apps=state.model.applications.filter(a=>matches([a.id,a.name,a.description,a.nature].join(' '))&&(state.status==='all'||(a.status||'established')===state.status));
 $('content').innerHTML='<div class="items">'+apps.map(a=>'<button class="item" data-kind="application" data-id="'+escape(a.id)+'"><div class="meta">'+escape(a.tagline)+'</div><strong>'+escape(a.name)+'</strong><p>'+escape(a.description)+'</p></button>').join('')+'</div>';
}
function renderCapabilities(){
 setHeading('Capability catalogue','The functional capabilities made available across the OneVision suite.');
 let list=state.model.capabilities.filter(c=>matches([c.id,c.name,c.summary,c.provider,...(c.tags||[])].join(' '))&&(state.status==='all'||(c.status||'established')===state.status));
 let html='<div class="panel"><h2>Capabilities</h2><p class="sub">One reusable definition per capability, irrespective of how many applications consume it.</p><div class="items">';
 for(const c of list)html+='<button class="item" data-kind="capability" data-id="'+escape(c.id)+'"><span class="meta">'+escape(c.provider)+' · '+escape(c.id)+'</span><strong>'+escape(c.name)+'</strong><p>'+escape(c.summary)+'</p>'+(c.status?badge(c.status):'')+'</button>';
 html+='</div></div>';$('content').innerHTML=html;
}

function workflowCard(w){
 return '<button class="item" data-kind="workflow" data-id="'+escape(w.id)+'"><div class="meta">CAPABILITY WORKFLOW · '+escape(w.participants.join(' + '))+'</div><strong>'+escape(w.name)+'</strong><p>'+escape(w.summary)+'</p><span class="meta">'+w.steps.length+' steps · Each capability belongs to its provider</span></button>';
}
function renderWorkflows(){
 setHeading('Capability workflows','How inherent capabilities from different applications combine to deliver a functional outcome.');
 const list=state.model.workflows.filter(workflowMatches);
 let html='<div class="panel"><h2>Cross-application capability sequences</h2><p class="sub">Select a workflow to examine the ordered capabilities and their owning applications. This describes functionality, not operational execution.</p><div class="items">';
 for(const w of list)html+=workflowCard(w);
 html+='</div></div>';
 for(const w of list)html+='<div class="panel"><h2>'+escape(w.name)+'</h2><p class="sub">'+escape(w.summary)+'</p><div class="workflow-steps">'+w.steps.map((s,index)=>{const c=cap(s.capability);return '<div class="workflow-step"><div class="step-number">'+(index+1)+'</div><button class="step-box" data-kind="capability" data-id="'+escape(c.id)+'"><span class="step-provider">'+escape(c.provider)+' · OWNED CAPABILITY</span><strong>'+escape(c.name)+'</strong><p>'+escape(c.summary)+'</p></button>'+connectionMarkup(s)+'</div>'}).join('')+'</div><div class="hint">These are documented functional dependencies, not runtime statuses or deployment connections.</div></div>';
 $('content').innerHTML=html;
}
function render(){const m=state.model;$('stats').innerHTML=[['Applications',m.applications.length],['Capabilities',m.capabilities.length],['Workflows',(m.workflows||[]).length]].map(([n,v])=>'<div class="stat"><strong>'+v+'</strong><small>'+n+'</small></div>').join('');$('updated').textContent='Updated '+m.updated;document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===state.view));({landscape:renderLandscape,applications:renderApplications,capabilities:renderCapabilities,workflows:renderWorkflows}[state.view])()}
function openDetail(kind,id){
 const m=state.model;let html='';
 if(kind==='application'){
  const a=app(id);if(!a)return;
  const cs=m.capabilities.filter(c=>c.provider===id),ws=appWorkflows(id);
  html='<h2>'+escape(a.name)+'</h2><div class="meta">'+escape(a.tagline)+'</div><p>'+escape(a.description)+'</p>';
  if(a.status)html+=badge(a.status);
  html+='<h3>Nature of application</h3><p>'+escape(a.nature||'Not documented')+'</p><h3>Role in connections</h3><p>'+escape(a.connectionRole||'Not documented')+'</p><h3>Source configuration capabilities</h3>';
  if(a.sourceConfiguration?.length)for(const s of a.sourceConfiguration)html+='<div class="source-profile"><strong>'+escape(s.type)+'</strong><p>'+escape(s.purpose)+'</p><span class="meta">'+escape(s.detail)+'</span></div>';else html+='<p class="meta">No source configuration documented.</p>';
  html+='<h3>Inherent capabilities</h3>'+(cs.map(c=>card(c.name,c.id,'capability',c.id,c.status)).join('')||'<p>None catalogued.</p>');
  html+='<h3>Participating workflows</h3>'+(ws.map(w=>card(w.name,w.id,'workflow',w.id,w.status)).join('')||'<p>None catalogued.</p>');
 }else if(kind==='capability'){
  const c=cap(id);if(!c)return;const ws=capWorkflows(id);
  html='<h2>'+escape(c.name)+'</h2><div class="meta">Owned by '+escape(c.provider)+' · '+escape(c.id)+'</div><p>'+escape(c.summary)+'</p><h3>Classification</h3><p>'+escape((c.tags||[]).join(' · '))+'</p><h3>Used in workflows</h3>'+(ws.map(w=>card(w.name,w.id,'workflow',w.id,w.status)).join('')||'<p>Not yet referenced.</p>');
 }else if(kind==='workflow'){
  const w=m.workflows.find(x=>x.id===id);if(!w)return;
  html='<h2>'+escape(w.name)+'</h2><div class="meta">CAPABILITY WORKFLOW · '+escape(w.participants.join(' + '))+'</div><p>'+escape(w.summary)+'</p><h3>Canonical capabilities</h3>';
  for(let n=0;n<w.steps.length;n++){const s=w.steps[n],c=cap(s.capability);if(!c)continue;html+='<div class="workflow-step"><div class="step-number">'+(n+1)+'</div><button class="step-box" data-kind="capability" data-id="'+escape(c.id)+'"><span class="step-provider">'+escape(c.provider)+' · '+escape(c.id)+'</span><strong>'+escape(c.name)+'</strong><p>'+escape(c.summary)+'</p></button>'+connectionMarkup(s)+'</div>'}
 }
 $('detail-body').innerHTML=html;$('detail').classList.remove('hidden');
}
document.addEventListener('click',e=>{const view=e.target.closest('[data-view]');if(view){state.view=view.dataset.view;$('detail').classList.add('hidden');render();return}const card=e.target.closest('[data-kind]');if(card)openDetail(card.dataset.kind,card.dataset.id)});
$('search').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();render()});
$('status').addEventListener('change',e=>{state.status=e.target.value;render()});
$('close').addEventListener('click',()=>$('detail').classList.add('hidden'));
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('detail').classList.add('hidden')});
fetch('data/architecture.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(m=>{if(!m.applications||!m.capabilities||!m.workflows||!m.endpoints)throw new Error('Incomplete model');
 const caps=new Map(m.capabilities.map(c=>[c.id,c])),eps=new Map(m.endpoints.map(e=>[e.id,e]));

 for(const w of m.workflows){for(const s of w.steps){if(!caps.has(s.capability))throw new Error('Unknown workflow capability: '+s.capability);if(s.description)throw new Error('Duplicate capability description in workflow: '+s.id);for(const id of s.connection?.endpointIds||[])if(!eps.has(id))throw new Error('Unknown endpoint: '+id)}const owners=[...new Set(w.steps.map(s=>caps.get(s.capability).provider))];if(owners.some(x=>!w.participants.includes(x)))throw new Error('Participants mismatch: '+w.id)}
 state.model=m;render()}).catch(e=>{$('content').innerHTML='<div class="panel">Unable to load architecture catalogue: '+escape(e.message)+'</div>'});
})();