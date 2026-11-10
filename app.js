(()=>{'use strict';
const $=id=>document.getElementById(id);
const state={view:'landscape',search:'',status:'all',model:null};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=id=>state.model.applications.find(a=>a.id===id);
const cap=id=>state.model.capabilities.find(c=>c.id===id);
const relation=i=>[i.consumer,i.provider,i.name,i.description,(i.capabilities||[]).map(id=>cap(id)?.name||'').join(' ')].join(' ').toLowerCase();
const matches=s=>!state.search||s.toLowerCase().includes(state.search);
const visible=i=>(state.status==='all'||(i.status||'established')===state.status)&&matches(relation(i));
const badge=status=>'<span class="pill '+(status==='planned'?'planned':'')+'">'+(status==='planned'?'Planned':'Established')+'</span>';
const flow=i=>'<div class="flowline"><span class="chip">'+escape(i.consumer)+'</span><span class="arrow">→</span><span class="chip">'+escape(i.provider)+'</span></div>';
const setHeading=(h,d)=>{$('heading').textContent=h;$('intro').textContent=d};
function card(title,subtitle,type,id,status){return '<button class="item" data-kind="'+type+'" data-id="'+escape(id)+'"><div class="meta">'+escape(subtitle)+'</div><strong>'+escape(title)+'</strong>'+(status?badge(status):'')+'</button>'}
function renderLandscape(){
 setHeading('Application landscape','Explore how OneVision applications relate and the capabilities they provide.');
 const apps=state.model.applications.filter(a=>matches([a.id,a.name,a.tagline,a.description].join(' ')));
 let html='<div class="panel"><h2>The OneVision ecosystem</h2><div class="sub">Select an application for its responsibilities and capabilities. Connections are functional, not live status indicators.</div><div class="landscape">';
 for(const a of apps)html+='<button class="node '+(a.group==='hub'?'hub':a.group==='standard'?'standard':a.group==='supporting'?'supporting':'')+'" data-kind="application" data-id="'+escape(a.id)+'"><strong>'+escape(a.id==='ONEVISION'?'OneVision':a.id==='UI'?'OneVision.UI':a.id)+'</strong><span>'+escape(a.tagline)+'</span><small>'+escape(a.description)+'</small></button>';
 html+='</div><div class="hint">OneVision.UI is a cross-cutting design standard, not a data integration. The OneVision suite hub and its connections are planned.</div></div>';
 const ints=state.model.integrations.filter(visible);
 html+='<div class="sectiontitle">Capability connections ('+ints.length+')</div><div class="connections">';
 for(const i of ints)html+='<button class="item" data-kind="integration" data-id="'+escape(i.id)+'">'+flow(i)+'<strong>'+escape(i.name)+'</strong><p>'+escape(i.description)+'</p>'+badge(i.status)+'</button>';
 html+='</div>';$('content').innerHTML=html;
}
function renderCapabilities(){
 setHeading('Capability catalogue','The functional capabilities made available across the OneVision suite.');
 let list=state.model.capabilities.filter(c=>matches([c.id,c.name,c.summary,c.provider,...(c.tags||[])].join(' '))&&(state.status==='all'||(c.status||'established')===state.status));
 let html='<div class="panel"><h2>Capabilities</h2><p class="sub">One reusable definition per capability, irrespective of how many applications consume it.</p><div class="items">';
 for(const c of list)html+='<button class="item" data-kind="capability" data-id="'+escape(c.id)+'"><span class="meta">'+escape(c.provider)+' · '+escape(c.id)+'</span><strong>'+escape(c.name)+'</strong><p>'+escape(c.summary)+'</p>'+(c.status?badge(c.status):'')+'</button>';
 html+='</div></div>';$('content').innerHTML=html;
}
function renderIntegrations(){
 setHeading('Integration explorer','See which application consumes which capability and why.');
 const ints=state.model.integrations.filter(visible);
 let html='<div class="panel"><h2>Functional relationships</h2><p class="sub">The arrow points from consumer to provider. Planned connections are clearly identified.</p><div class="items">';
 for(const i of ints)html+='<button class="item" data-kind="integration" data-id="'+escape(i.id)+'">'+flow(i)+'<strong>'+escape(i.name)+'</strong><p>'+escape(i.description)+'</p>'+badge(i.status)+'</button>';
 html+='</div></div>';$('content').innerHTML=html;
}

function workflowCard(w){
 return '<button class="item" data-kind="workflow" data-id="'+escape(w.id)+'"><div class="meta">CAPABILITY WORKFLOW · '+escape(w.participants.join(' + '))+'</div><strong>'+escape(w.name)+'</strong><p>'+escape(w.summary)+'</p><span class="meta">'+w.steps.length+' steps · Each capability belongs to its provider</span></button>';
}
function renderWorkflows(){
 setHeading('Capability workflows','How inherent capabilities from different applications combine to deliver a functional outcome.');
 const list=(state.model.workflows||[]).filter(w=>matches([w.name,w.summary,w.participants.join(' '),...w.steps.map(s=>cap(s.capability)?.name||'')].join(' '))&&(state.status==='all'||w.status===state.status));
 let html='<div class="panel"><h2>Cross-application capability sequences</h2><p class="sub">Select a workflow to examine the ordered capabilities and their owning applications. This describes functionality, not operational execution.</p><div class="items">';
 for(const w of list)html+=workflowCard(w);
 html+='</div></div>';
 for(const w of list)html+='<div class="panel"><h2>'+escape(w.name)+'</h2><p class="sub">'+escape(w.summary)+'</p><div class="workflow-steps">'+w.steps.map((s,index)=>{const c=cap(s.capability);return '<div class="workflow-step"><div class="step-number">'+(index+1)+'</div><button class="step-box" data-kind="capability" data-id="'+escape(c.id)+'"><span class="step-provider">'+escape(c.provider)+' · OWNED CAPABILITY</span><strong>'+escape(c.name)+'</strong><p>'+escape(s.description)+'</p></button></div>'}).join('')+'</div><div class="hint">These are documented functional dependencies, not runtime statuses or deployment connections.</div></div>';
 $('content').innerHTML=html;
}
function render(){const m=state.model;$('stats').innerHTML=[['Applications',m.applications.length],['Capabilities',m.capabilities.length],['Workflows',(m.workflows||[]).length]].map(([n,v])=>'<div class="stat"><strong>'+v+'</strong><small>'+n+'</small></div>').join('');$('updated').textContent='Updated '+m.updated;document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===state.view));({landscape:renderLandscape,capabilities:renderCapabilities,integrations:renderIntegrations,workflows:renderWorkflows}[state.view])()}
function openDetail(kind,id){
 const m=state.model;let html='';
 if(kind==='application'){
  const a=app(id);if(!a)return;
  const cs=m.capabilities.filter(c=>c.provider===id),ints=m.integrations.filter(i=>i.provider===id||i.consumer===id);
  html='<h2>'+escape(a.name)+'</h2><div class="meta">'+escape(a.tagline)+'</div><p>'+escape(a.description)+'</p>';
  if(a.status)html+=badge(a.status);
  html+='<h3>Provided capabilities</h3>'+(cs.map(c=>card(c.name,c.id,'capability',c.id,c.status)).join('')||'<p>None catalogued.</p>');
  html+='<h3>Application relationships</h3>'+(ints.map(i=>card(i.name,i.consumer+' → '+i.provider,'integration',i.id,i.status)).join('')||'<p>None catalogued.</p>');
 }else if(kind==='capability'){
  const c=cap(id);if(!c)return;const ints=m.integrations.filter(i=>i.capabilities.includes(id));
  html='<h2>'+escape(c.name)+'</h2><div class="meta">Provided by '+escape(c.provider)+' · '+escape(c.id)+'</div><p>'+escape(c.summary)+'</p><h3>Classification</h3><p>'+escape((c.tags||[]).join(' · '))+'</p><h3>Consumers and integrations</h3>'+(ints.map(i=>card(i.name,i.consumer+' → '+i.provider,'integration',i.id,i.status)).join('')||'<p>No consuming integration catalogued.</p>');
 }else if(kind==='workflow'){
  const w=(m.workflows||[]).find(x=>x.id===id);if(!w)return;
  html='<h2>'+escape(w.name)+'</h2><div class="meta">CAPABILITY WORKFLOW · '+escape(w.participants.join(' + '))+'</div><p>'+escape(w.summary)+'</p><h3>Capability sequence</h3>';
  for(let n=0;n<w.steps.length;n++){const s=w.steps[n],c=cap(s.capability);if(!c)continue;html+='<div class="workflow-step"><div class="step-number">'+(n+1)+'</div><button class="step-box" data-kind="capability" data-id="'+escape(c.id)+'"><span class="step-provider">'+escape(c.provider)+'</span><strong>'+escape(c.name)+'</strong><p>'+escape(s.description)+'</p></button></div>'}
  html+='<h3>Related integrations</h3>'+(w.relatedIntegrations||[]).map(id=>{const i=m.integrations.find(v=>v.id===id);return i?card(i.name,i.consumer+' → '+i.provider,'integration',i.id,i.status):''}).join('');
 }else if(kind==='integration'){
  const i=m.integrations.find(x=>x.id===id);if(!i)return;
  html='<h2>'+escape(i.name)+'</h2>'+flow(i)+'<div>'+badge(i.status)+'</div><p>'+escape(i.description)+'</p><h3>Exposed capabilities</h3>';
  html+=i.capabilities.map(id=>{const c=cap(id);return c?card(c.name,c.provider+' · '+c.id,'capability',c.id):''}).join('');
  html+='<h3>Interaction mechanism</h3><p>'+escape(i.mechanism)+'</p>';
  if(i.notes)html+='<h3>Functional rules and notes</h3><p>'+escape(i.notes)+'</p>';
 }
 $('detail-body').innerHTML=html;$('detail').classList.remove('hidden');
}
document.addEventListener('click',e=>{const view=e.target.closest('[data-view]');if(view){state.view=view.dataset.view;$('detail').classList.add('hidden');render();return}const card=e.target.closest('[data-kind]');if(card)openDetail(card.dataset.kind,card.dataset.id)});
$('search').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();render()});
$('status').addEventListener('change',e=>{state.status=e.target.value;render()});
$('close').addEventListener('click',()=>$('detail').classList.add('hidden'));
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('detail').classList.add('hidden')});
fetch('data/architecture.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(m=>{if(!m.applications||!m.capabilities||!m.integrations)throw new Error('Incomplete model');state.model=m;render()}).catch(e=>{$('content').innerHTML='<div class="panel">Unable to load architecture catalogue: '+escape(e.message)+'</div>'});
})();