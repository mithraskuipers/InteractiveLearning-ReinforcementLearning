/* ================================================
   UI CONTROLLER
   Globals, utilities, DOM rendering, navigation,
   playback, and app initialisation.
   Load order: data-builders.js → charts.js → ui.js
   ================================================ */

/* ------------------------------------------------
   Globals (shared with charts.js via window scope)
   ------------------------------------------------ */
let mode = 'basics', cur = 0, total = 0, stepsData = [], playing = false, playTimer = null;
const charts = {};

/* ------------------------------------------------
   DOM utilities
   ------------------------------------------------ */
function gc(id){ return +document.getElementById(id).value; }
function gv(id){ return document.getElementById(id).value; }
function sv(id, v){ document.getElementById(id).textContent = v; }

/* ------------------------------------------------
   Formula / Explain card / Chips
   ------------------------------------------------ */
function renderFormula(){
  const s=stepsData[cur]||{};
  document.getElementById('formulaLine').innerHTML=s.formula||'';
}
function renderExplain(){
  const s=stepsData[cur]||{};
  document.getElementById('explainCard').innerHTML=s.explain||'';
}
function renderChips(){
  const s=stepsData[cur]||{};
  const chips=s.chips||[];
  document.getElementById('chipsRow').innerHTML=chips.map(([l,v,c])=>
    `<div class="chip ${c||''}"><div class="chip-label">${l}</div><div class="chip-val">${v}</div></div>`
  ).join('');
}

/* ------------------------------------------------
   Step history table
   ------------------------------------------------ */
function buildTableHead(){
  const th=document.getElementById('tHead');
  if(mode==='basics')      th.innerHTML='<tr><th>Step</th><th>State</th><th>Action</th><th>Reward</th><th>Total R</th></tr>';
  else if(mode==='qlearning') th.innerHTML='<tr><th>Step</th><th>State</th><th>Action</th><th>Reward</th><th>TD δ</th><th>Episode</th></tr>';
  else if(mode==='gridworld') th.innerHTML='<tr><th>Step</th><th>Title</th><th>Episode</th><th>Ep Step</th><th>Reward</th><th>ε</th></tr>';
  else                     th.innerHTML='<tr><th>Step</th><th>Action</th><th>Arm</th><th>Reward</th><th>Cumul R</th><th>Regret</th></tr>';
}

function makeRow(i){
  const s=stepsData[i]||{};
  if(mode==='basics')
    return `<td>${i}</td><td style="color:#7a9bbb">${s.nextState||''}</td><td style="color:#ffb830">${s.action||''}</td><td style="color:${(s.totalR||0)>0?'#00e599':'#ff4d6a'}">${s.reward||''}</td><td style="color:#00e599;font-weight:700">${(s.totalR||0).toFixed(2)}</td>`;
  else if(mode==='qlearning'){
    const c=s.cfg||{};
    return `<td>${i}</td><td style="color:#00d4ff">${(c.states&&s.s>=0)?c.states[s.s]||'':'N/A'}</td><td style="color:#ffb830">${(c.actions&&s.a>=0)?c.actions[s.a]||'':'N/A'}</td><td style="color:${(s.r||0)>0?'#00e599':'#ff4d6a'}">${s.r||0}</td><td style="color:${(s.delta||0)>0?'#00e599':'#ff4d6a'}">${(s.delta||0).toFixed(4)}</td><td style="color:#a855f7">${s.episode||1}</td>`;
  } else if(mode==='gridworld'){
    return `<td>${i}</td><td style="color:#7a9bbb;font-size:10px">${(s.title||'').slice(0,28)}</td><td style="color:#a855f7">${s.episode||0}</td><td style="color:#ffb830">${s.epStep||0}</td><td style="color:${(s.totalR||0)>0?'#00e599':'#ff4d6a'}">${(s.totalR||0).toFixed(2)}</td><td style="color:#ff7043">${(s.epsilon||0).toFixed(2)}</td>`;
  } else {
    return `<td>${i}</td><td style="color:${s.isExplore?'#ff7043':'#a855f7'}">${s.isExplore?'Explore':'Exploit'}</td><td style="color:#00d4ff">${s.labels?s.labels[s.chosen]||'':''}</td><td style="color:#00e599">${s.reward||0}</td><td style="color:#00e599;font-weight:700">${(s.cumulativeR||0).toFixed(2)}</td><td style="color:#ff4d6a">${(s.totalRegret||0).toFixed(2)}</td>`;
  }
}

function refreshTable(){
  const tbody=document.getElementById('tBody'), sc=document.querySelector('.table-scroll-wrap');
  while(tbody.rows.length>cur+1) tbody.deleteRow(tbody.rows.length-1);
  for(let i=tbody.rows.length;i<=cur;i++){
    const tr=document.createElement('tr');
    tr.innerHTML=makeRow(i);
    tr.style.cursor='pointer';
    tr.onclick=()=>jumpTo(i);
    tbody.appendChild(tr);
  }
  Array.from(tbody.rows).forEach((r,i)=>r.classList.toggle('cur',i===cur));
  const row=tbody.rows[cur];
  if(row&&sc){
    const rb=row.offsetTop+row.offsetHeight;
    if(rb>sc.scrollTop+sc.clientHeight) sc.scrollTop=rb-sc.clientHeight+4;
    else if(row.offsetTop<sc.scrollTop) sc.scrollTop=row.offsetTop-4;
  }
}

/* ------------------------------------------------
   Progress dots
   ------------------------------------------------ */
function refreshDots(){
  const wrap=document.getElementById('dotsWrap'), max=Math.min(total+1,30);
  if(wrap.children.length!==max){
    wrap.innerHTML='';
    for(let i=0;i<max;i++){
      const d=document.createElement('div');
      d.className='dot';
      d.onclick=()=>jumpTo(Math.round(i*total/(max-1)));
      wrap.appendChild(d);
    }
  }
  wrap.querySelectorAll('.dot').forEach((d,i)=>{
    const st=Math.round(i*total/(max-1));
    d.className='dot'+(st===cur?' active':st<cur?' done':'');
  });
}

/* ------------------------------------------------
   Master UI refresh — called after every step change
   ------------------------------------------------ */
function updateUI(){
  const s=stepsData[cur]||{};
  const badge=document.getElementById('stepBadge');
  const titleEl=document.getElementById('stepTitle');
  badge.textContent='Step '+cur;
  titleEl.textContent=s.title||('Step '+cur);
  if(s.isTerminal&&!s.isTrap){
    badge.style.background='rgba(0,229,153,.2)'; badge.style.color='var(--green)'; badge.style.borderColor='var(--green)';
  } else if(s.isTrap){
    badge.style.background='rgba(255,77,106,.15)'; badge.style.color='var(--red)'; badge.style.borderColor='var(--red)';
  } else {
    badge.style.background='rgba(0,212,255,.12)'; badge.style.color='var(--accent)'; badge.style.borderColor='var(--accent)';
  }
  document.getElementById('btnPrev').disabled=cur<=0;
  document.getElementById('btnNext').disabled=cur>=total;
  refreshDots(); renderFormula(); renderExplain(); renderChips(); renderCharts(); refreshTable();
}

/* ------------------------------------------------
   Navigation
   ------------------------------------------------ */
function nextStep(){ if(cur<total){ cur++; updateUI(); } }
function prevStep(){ if(cur>0){ cur--; updateUI(); } }
function jumpTo(n){ cur=n; updateUI(); }

/* ------------------------------------------------
   Playback
   ------------------------------------------------ */
function togglePlay(){
  if(playing){ stopPlay(); return; }
  playing=true;
  document.getElementById('btnPlay').textContent='⏸ Pause';
  playTimer=setInterval(()=>{ if(cur>=total){ stopPlay(); return; } nextStep(); }, 1000);
}
function stopPlay(){
  playing=false;
  clearInterval(playTimer);
  document.getElementById('btnPlay').textContent='▶ Play';
}

/* ------------------------------------------------
   Mode switching & full reset
   ------------------------------------------------ */
function switchMode(m){
  mode=m;
  document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',['basics','qlearning','gridworld','epsilon'][i]===m));
  document.querySelectorAll('.sc').forEach(el=>el.classList.remove('active'));
  document.getElementById('sc-'+m).classList.add('active');
  resetAll();
}

function resetAll(){
  stopPlay(); cur=0;
  document.getElementById('tBody').innerHTML='';
  if(mode==='basics'){
    stepsData=buildBasics(gv('basics-sc'));
  } else if(mode==='qlearning'){
    const alpha=gc('ql-alpha')/10;
    const gamma=gc('ql-gamma')/10;
    sv('ql-av',alpha.toFixed(1)); sv('ql-gv',gamma.toFixed(1));
    stepsData=buildQLearning(gv('ql-sc'),alpha,gamma);
  } else if(mode==='gridworld'){
    stepsData=buildGridWorld(gc('gw-size'),gc('gw-ep'));
  } else {
    const epStart=gc('ep-start')/10;
    const epDecay=gc('ep-decay')/100;
    sv('ep-sv',epStart.toFixed(1)); sv('ep-dv',epDecay.toFixed(2));
    stepsData=buildEpsilon(gv('ep-sc'),epStart,epDecay);
  }
  total=stepsData.length-1;
  setupCharts(); buildTableHead(); updateUI();
}

/* ------------------------------------------------
   Keyboard shortcuts
   ------------------------------------------------ */
document.addEventListener('keydown', e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
  if(e.key==='.') nextStep();
  if(e.key===',') prevStep();
  if(e.key===' '){ e.preventDefault(); togglePlay(); }
});

/* ------------------------------------------------
   Boot
   ------------------------------------------------ */
resetAll();
