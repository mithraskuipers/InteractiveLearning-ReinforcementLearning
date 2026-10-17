/* ================================================
   UI CONTROLLER
   Globals, utilities, DOM rendering, navigation,
   playback, and app initialisation.
   Load order: data-builders.js → charts.js → ui.js
   ================================================ */

/* ------------------------------------------------
   Globals (shared with charts.js via window scope)
   ------------------------------------------------ */
let mode = 'intro', cur = 0, total = 0, stepsData = [], playing = false, playTimer = null;
const charts = {};

/* Order = the recommended learning path for newcomers. */
const MODES = ['intro', 'basics', 'qlearning', 'gridworld', 'epsilon'];
const MODE_LABELS = { intro: 'Big Picture', basics: 'RL Basics', qlearning: 'Q-Learning', gridworld: 'Grid World', epsilon: 'Exploration' };
const MODE_DESC = {
  intro: 'what Reinforcement Learning is, in plain words',
  basics: 'watch one full episode, step by step',
  qlearning: 'how the agent remembers what works',
  gridworld: 'learn a whole map by trial and error',
  epsilon: 'try new things, or stick with the best so far?'
};
const NEXT_MODE = { intro: 'basics', basics: 'qlearning', qlearning: 'gridworld', gridworld: 'epsilon', epsilon: null };

/* Trained-agent playback state (greedy rollout of the learned policy) */
let trainedFrames = [], trainedIdx = -1, trainedPlaying = false, trainedTimer = null;

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
  if(mode==='intro')       th.innerHTML='<tr><th>Step</th><th>Concept</th><th>Details</th></tr>';
  else if(mode==='basics') th.innerHTML='<tr><th>Step</th><th>State</th><th>Action</th><th>Reward</th><th>Total R</th></tr>';
  else if(mode==='qlearning') th.innerHTML='<tr><th>Step</th><th>State</th><th>Action</th><th>Reward</th><th>TD δ</th><th>Episode</th></tr>';
  else if(mode==='gridworld') th.innerHTML='<tr><th>Step</th><th>Title</th><th>Episode</th><th>Ep Step</th><th>Reward</th><th>ε</th></tr>';
  else                     th.innerHTML='<tr><th>Step</th><th>Action</th><th>Arm</th><th>Reward</th><th>Cumul R</th><th>Regret</th></tr>';
}

function makeRow(i){
  const s=stepsData[i]||{};
  if(mode==='intro'){
    const details=(s.chips||[]).map(c=>`${c[0]}: ${c[1]}`).join(' &nbsp;·&nbsp; ');
    return `<td>${i}</td><td style="color:var(--accent);font-weight:600">${s.title||''}</td><td style="color:var(--ink2);font-size:12px">${details}</td>`;
  }
  if(mode==='basics')
    return `<td>${i}</td><td style="color:var(--ink2)">${s.nextState||''}</td><td style="color:var(--gold)">${s.action||''}</td><td style="color:${(s.totalR||0)>0?'var(--green)':'var(--red)'}">${s.reward||''}</td><td style="color:var(--green);font-weight:700">${(s.totalR||0).toFixed(2)}</td>`;
  else if(mode==='qlearning'){
    const c=s.cfg||{};
    return `<td>${i}</td><td style="color:var(--accent)">${(c.states&&s.s>=0)?c.states[s.s]||'':'N/A'}</td><td style="color:var(--gold)">${(c.actions&&s.a>=0)?c.actions[s.a]||'':'N/A'}</td><td style="color:${(s.r||0)>0?'var(--green)':'var(--red)'}">${s.r||0}</td><td style="color:${(s.delta||0)>0?'var(--green)':'var(--red)'}">${(s.delta||0).toFixed(4)}</td><td style="color:var(--purple)">${s.episode||1}</td>`;
  } else if(mode==='gridworld'){
    return `<td>${i}</td><td style="color:var(--ink2);font-size:10px">${(s.title||'').slice(0,28)}</td><td style="color:var(--purple)">${s.episode||0}</td><td style="color:var(--gold)">${s.epStep||0}</td><td style="color:${(s.totalR||0)>0?'var(--green)':'var(--red)'}">${(s.totalR||0).toFixed(2)}</td><td style="color:var(--orange)">${(s.epsilon||0).toFixed(2)}</td>`;
  } else {
    return `<td>${i}</td><td style="color:${s.isExplore?'var(--orange)':'var(--purple)'}">${s.isExplore?'Explore':'Exploit'}</td><td style="color:var(--accent)">${s.labels?s.labels[s.chosen]||'':''}</td><td style="color:var(--green)">${s.reward||0}</td><td style="color:var(--green);font-weight:700">${(s.cumulativeR||0).toFixed(2)}</td><td style="color:var(--red)">${(s.totalRegret||0).toFixed(2)}</td>`;
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
   Master UI refresh - called after every step change
   ------------------------------------------------ */
function updateUI(){
  const s=stepsData[cur]||{};
  const badge=document.getElementById('stepBadge');
  const titleEl=document.getElementById('stepTitle');
  badge.textContent='Step '+cur;
  titleEl.textContent=s.title||('Step '+cur);
  if(s.isTerminal&&!s.isTrap){
    badge.style.background='var(--green-soft)'; badge.style.color='var(--green)'; badge.style.borderColor='var(--green)';
  } else if(s.isTrap){
    badge.style.background='var(--red-soft)'; badge.style.color='var(--red)'; badge.style.borderColor='var(--red)';
  } else {
    badge.style.background='var(--accent-soft)'; badge.style.color='var(--accent)'; badge.style.borderColor='var(--accent)';
  }
  document.getElementById('btnPrev').disabled=cur<=0;
  document.getElementById('btnNext').disabled=cur>=total;
  refreshDots(); renderFormula(); renderExplain(); renderChips(); renderCharts(); refreshTable();
  updateNextCta();
}

/* Shown once the walkthrough for this stop is finished */
function updateNextCta(){
  const box=document.getElementById('nextCta'); if(!box) return;
  const finished=cur>=total;
  box.style.display=finished?'flex':'none';
  if(!finished) return;
  document.getElementById('nextCtaDone').textContent=MODE_LABELS[mode];
  const n=NEXT_MODE[mode];
  const btn=document.getElementById('nextCtaBtn');
  btn.textContent=n?('Continue to '+MODE_LABELS[n]+' →'):'You made it. Replay any stop!';
  btn.disabled=!n;
}
function goToNextMode(){
  const n=NEXT_MODE[mode];
  if(n){ switchMode(n); window.scrollTo({top:0,behavior:'smooth'}); }
}

/* Tab bar: tick finished stops and describe the current one */
function refreshRoadmap(){
  const curIdx=MODES.indexOf(mode);
  document.querySelectorAll('.tab-btn').forEach(el=>{
    const idx=MODES.indexOf(el.dataset.mode);
    el.classList.toggle('done',idx<curIdx);
    const num=el.querySelector('.tab-num');
    if(num) num.textContent=idx<curIdx?'✓':idx+1;
  });
  const d=document.getElementById('tabDesc');
  if(d) d.innerHTML='<b>Stop '+(curIdx+1)+' of '+MODES.length+':</b> '+MODE_DESC[mode];
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
   Trained agent playback
   Once a demo has finished training (the walkthrough
   above has produced a final Q-table), this replays
   the LEARNED policy greedily - no exploration, no
   scripted narrative - against the environment, so
   you can watch the trained model actually perform.
   ------------------------------------------------ */
function playTrainedAgent(){
  if(mode==='basics'||mode==='intro') return;
  stopPlay();
  if(trainedPlaying){ stopTrainedPlay(); return; }

  const finalStep = stepsData[total];
  if(mode==='qlearning'){
    trainedFrames = rolloutQLearning(gv('ql-sc'), finalStep.cfg, finalStep.Q);
  } else if(mode==='gridworld'){
    trainedFrames = rolloutGridWorld(finalStep.N, finalStep.trapStates, finalStep.wallStates, finalStep.goalState, finalStep.Q);
  } else {
    trainedFrames = rolloutBandit(finalStep.trueValues, finalStep.Q, 12);
  }
  if(!trainedFrames.length) return;

  trainedIdx = 0;
  trainedPlaying = true;
  document.getElementById('trainedPanel').classList.add('show');
  const btn = document.getElementById('btnTrained');
  btn.classList.add('active'); btn.textContent = '⏹ Stop Trained Run';
  renderTrainedPanel();
  trainedTimer = setInterval(()=>{
    if(trainedIdx >= trainedFrames.length-1){ finishTrainedPlay(); return; }
    trainedIdx++; renderTrainedPanel();
  }, 700);
}

function finishTrainedPlay(){
  trainedPlaying = false;
  clearInterval(trainedTimer);
  const btn = document.getElementById('btnTrained');
  btn.classList.remove('active'); btn.textContent = '↻ Replay Trained Agent';
}

function stopTrainedPlay(){
  trainedPlaying = false;
  clearInterval(trainedTimer);
  const btn = document.getElementById('btnTrained');
  if(btn) { btn.classList.remove('active'); btn.textContent = trainedFrames.length ? '↻ Replay Trained Agent' : '🏁 Play Trained Agent'; }
}

function closeTrainedPanel(){
  trainedPlaying = false;
  clearInterval(trainedTimer);
  trainedFrames = []; trainedIdx = -1;
  const btn = document.getElementById('btnTrained');
  if(btn){ btn.classList.remove('active'); btn.textContent = '🏁 Play Trained Agent'; }
  document.getElementById('trainedPanel').classList.remove('show');
}

function renderTrainedPanel(){
  const panel = document.getElementById('trainedPanel');
  const frames = trainedFrames;
  const f = frames[trainedIdx];
  const isLast = trainedIdx === frames.length-1;
  let bodyHtml = '', outcomeHtml = '';

  if(mode==='qlearning'){
    const cfg = stepsData[total].cfg;
    bodyHtml += `<div class="trained-chain">` + cfg.states.map((st,i)=>{
      const label = st.split('\n')[0];
      const reached = frames.slice(0,trainedIdx+1).some(fr=>fr.ns===i);
      const isCur = f && f.ns===i;
      return `<div class="tc-node ${isCur?'active':reached?'done':''}">${label}</div>` +
             (i<cfg.states.length-1 ? '<span class="tc-arrow">→</span>' : '');
    }).join('') + `</div>`;
    bodyHtml += `<div class="trained-log" style="margin-top:14px">` + frames.map((fr,i)=>
      `<div class="trained-log-row ${i===trainedIdx?'active':''} ${fr.r>0?'good':fr.r<0?'bad':''}" style="display:${i<=trainedIdx?'flex':'none'}">
        <span>s${fr.s} → <strong>${cfg.actions[fr.a]}</strong> → s${fr.ns}</span>&nbsp; r=${fr.r}${fr.terminal?' · terminal':''}
      </div>`).join('') + `</div>`;
    if(isLast){
      const success = f.terminal && f.r>0;
      outcomeHtml = `<div class="trained-summary">
        <div class="trained-stat"><span class="l">Outcome</span><span class="v" style="color:${success?'var(--green)':'var(--ink2)'}">${success?'Goal reached':'Episode ended'}</span></div>
        <div class="trained-stat"><span class="l">Steps</span><span class="v">${frames.length}</span></div>
        <div class="trained-stat"><span class="l">Total Reward</span><span class="v" style="color:${f.totalR>0?'var(--green)':'var(--red)'}">${f.totalR}</span></div>
      </div>`;
    }
  } else if(mode==='gridworld'){
    const { N, trapStates, wallStates, goalState } = stepsData[total];
    const EMOJI={goal:'🏆',trap:'⚠️',wall:'⛔',agent:'🤖'};
    const pathSoFar = new Set(frames.slice(0,trainedIdx+1).map(fr=>fr.ns).concat([0]));
    const agentPos = f ? f.ns : 0;
    let grid = `<div class="trained-mini-grid" style="grid-template-columns:repeat(${N},1fr)">`;
    for(let i=0;i<N*N;i++){
      const isWall=wallStates.includes(i), isGoal=i===goalState, isTrap=trapStates.includes(i), isAgent=i===agentPos, onPath=pathSoFar.has(i);
      const cls = isWall?'tg-wall':isGoal?'tg-goal':isTrap?'tg-trap':isAgent?'tg-agent':onPath?'tg-path':'';
      const icon = isAgent?EMOJI.agent:isGoal?EMOJI.goal:isTrap?EMOJI.trap:isWall?EMOJI.wall:'';
      grid += `<div class="tg-cell ${cls}">${icon}</div>`;
    }
    grid += `</div>`;
    const log = `<div class="trained-log">` + frames.map((fr,i)=>
      `<div class="trained-log-row ${i===trainedIdx?'active':''} ${fr.isGoal?'good':fr.isTrap?'bad':''}" style="display:${i<=trainedIdx?'flex':'none'}">
        <span>s${fr.s} ${fr.sym} → s${fr.ns}</span>&nbsp; r=${fr.r}${fr.isGoal?' · 🏆 goal':fr.isTrap?' · ⚠️ trap':''}
      </div>`).join('') + `</div>`;
    bodyHtml = `<div class="trained-body"><div class="trained-visual">${grid}</div>${log}</div>`;
    if(isLast){
      outcomeHtml = `<div class="trained-summary">
        <div class="trained-stat"><span class="l">Outcome</span><span class="v" style="color:${f.isGoal?'var(--green)':f.isTrap?'var(--red)':'var(--ink2)'}">${f.isGoal?'Goal reached':f.isTrap?'Fell in trap':'Stalled'}</span></div>
        <div class="trained-stat"><span class="l">Steps</span><span class="v">${frames.length}</span></div>
        <div class="trained-stat"><span class="l">Total Reward</span><span class="v" style="color:${f.totalR>0?'var(--green)':'var(--red)'}">${f.totalR}</span></div>
      </div>`;
    }
  } else {
    const labels = stepsData[total].labels;
    const maxAbs = Math.max(...frames.map(fr=>Math.abs(fr.r)),1);
    bodyHtml = `<div class="trained-arms">` + frames.map((fr,i)=>
      `<div class="ta-row ${i===trainedIdx?'active':''}" style="display:${i<=trainedIdx?'flex':'none'}">
        <span style="min-width:70px">${labels[fr.arm]}</span>
        <div class="ta-bar-bg"><div class="ta-bar-fill" style="width:${Math.max(4,Math.abs(fr.r)/maxAbs*100)}%"></div></div>
        <span style="min-width:50px;text-align:right;color:${fr.r>=0?'var(--green)':'var(--red)'}">${fr.r}</span>
      </div>`).join('') + `</div>`;
    if(isLast){
      outcomeHtml = `<div class="trained-summary">
        <div class="trained-stat"><span class="l">Pulls</span><span class="v">${frames.length}</span></div>
        <div class="trained-stat"><span class="l">Arm Chosen</span><span class="v" style="color:var(--gold)">${labels[frames[0].arm]}</span></div>
        <div class="trained-stat"><span class="l">Avg Reward</span><span class="v" style="color:var(--green)">${(f.cumR/frames.length).toFixed(2)}</span></div>
      </div>`;
    }
  }

  panel.innerHTML = `
    <div class="trained-head">
      <span class="trained-badge">🏁 Trained Agent - Greedy Policy</span>
      <span class="trained-status">Step ${trainedIdx+1} / ${frames.length}${isLast?' · complete':''}</span>
      <button class="trained-close" onclick="closeTrainedPanel()">✕ Close</button>
    </div>
    ${bodyHtml}
    ${outcomeHtml}
  `;
}

/* ------------------------------------------------
   Mode switching & full reset
   ------------------------------------------------ */
function switchMode(m){
  mode=m;
  document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',MODES[i]===m));
  document.querySelectorAll('.sc').forEach(el=>el.classList.remove('active'));
  document.getElementById('sc-'+m).classList.add('active');
  document.getElementById('btnTrained').disabled = (m==='basics'||m==='intro');
  refreshRoadmap();
  resetAll();
}

function resetAll(){
  stopPlay(); closeTrainedPanel(); cur=0;
  document.getElementById('tBody').innerHTML='';
  if(mode==='intro'){
    stepsData=buildIntro(gv('intro-sc'));
  } else if(mode==='basics'){
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
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||(e.key===' '&&e.target.tagName==='BUTTON')) return;
  if(e.key==='.') nextStep();
  if(e.key===',') prevStep();
  if(e.key===' '){ e.preventDefault(); togglePlay(); }
});

/* ------------------------------------------------
   Boot
   ------------------------------------------------ */
resetAll();
refreshRoadmap();
