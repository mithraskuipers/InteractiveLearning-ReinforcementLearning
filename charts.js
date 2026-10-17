/* ================================================
   CHARTS
   Depends on: Chart.js (global), globals from ui.js
   (charts, stepsData, cur, mode)
   ================================================ */

/* ------------------------------------------------
   Low-level Chart.js wrapper
   Updates in-place when possible (no animation),
   recreates only on first render or type change.
   ------------------------------------------------ */
function canvasChart(id, cfg){
  const el = document.getElementById(id);
  if(!el) return;
  const baseFont = { family:'Inter, system-ui, sans-serif', size:11, color:'#8791a3' };
  const gridColor = 'rgba(18,23,43,.08)';
  const datasets = cfg.datasets.map(ds => ({
    label: ds.label,
    data: ds.data,
    borderColor: ds.color,
    backgroundColor: ds.fill || 'transparent',
    borderWidth: ds.width || 1.5,
    borderDash: ds.dash || [],
    pointRadius: ds.dots ? 3 : 0,
    pointBackgroundColor: ds.color,
    fill: !!ds.fill,
    tension: 0.35
  }));
  const annotations = {};
  (cfg.refLines||[]).forEach((r,i)=>{
    annotations['ref'+i]={type:'line',yMin:r.value,yMax:r.value,borderColor:r.color,borderWidth:1,borderDash:[4,4]};
  });

  if(charts[id] && charts[id].config.type === (cfg.type || 'line')){
    const c = charts[id];
    c.data.labels = cfg.labels;
    while(c.data.datasets.length > datasets.length) c.data.datasets.pop();
    datasets.forEach((ds, i) => {
      if(c.data.datasets[i]){ Object.assign(c.data.datasets[i], ds); }
      else { c.data.datasets.push(ds); }
    });
    c.options.scales.y.min = cfg.yMin;
    c.options.scales.y.max = cfg.yMax;
    c.update('none');
    return;
  }

  if(charts[id]){ charts[id].destroy(); delete charts[id]; }
  charts[id] = new Chart(el, {
    type: cfg.type || 'line',
    data: { labels: cfg.labels, datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: !!cfg.legend, labels:{ color:'#4c5468', font: baseFont, boxWidth:8 } },
        annotation: { annotations }
      },
      scales: {
        x: { ticks:{ color:'#8791a3', font: baseFont, maxTicksLimit:12 }, grid:{ color:gridColor } },
        y: { min: cfg.yMin, max: cfg.yMax, type: cfg.yLog?'logarithmic':'linear',
             ticks:{ color:'#8791a3', font: baseFont }, grid:{ color:gridColor } }
      }
    }
  });
}

/* ------------------------------------------------
   DOM layout - injects canvas wrappers per mode
   ------------------------------------------------ */
function setupCharts(){
  Object.values(charts).forEach(c=>c.destroy());
  Object.keys(charts).forEach(k=>delete charts[k]);
  const area = document.getElementById('chartsArea');
  const cv = id => `<div class="chart-inner"><canvas id="${id}"></canvas></div>`;
  if(mode==='intro'){
    area.innerHTML=`<div id="loopDiagram"></div><div class="loop-note" id="loopNote"></div>`;
  } else if(mode==='basics'){
    area.innerHTML=`
      <div class="chart-grid cols-2">
        <div class="chart-box"><h4>Cumulative Reward vs Episode Steps</h4>${cv('b-reward')}</div>
        <div class="chart-box"><h4>State-Action-Reward Flow</h4>${cv('b-sar')}</div>
      </div>`;
  } else if(mode==='qlearning'){
    area.innerHTML=`
      <div class="chart-grid cols-2" style="margin-bottom:12px">
        <div class="chart-box"><h4>Q-Values Over Updates</h4>${cv('ql-qvals')}</div>
        <div class="chart-box"><h4>TD Error (<span style="text-transform:none">δ</span>) per Step</h4>${cv('ql-delta')}</div>
      </div>
      <div class="qtable-wrap" id="qtableWrap">
        <h4>Q-Table: current values</h4>
        <div class="qtable-scroll"><table id="qtable"></table></div>
      </div>`;
  } else if(mode==='gridworld'){
    area.innerHTML=`
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;align-items:flex-start">
        <div id="gwGrid"></div>
        <div style="flex:1;min-width:260px">
          <div class="chart-box"><h4>Episode Reward Over Time</h4>${cv('gw-rew')}</div>
        </div>
      </div>
      <div class="chart-grid cols-2">
        <div class="chart-box"><h4>Visit Count (heat map)</h4>${cv('gw-visits')}</div>
        <div class="chart-box"><h4>Max Q per State</h4>${cv('gw-qmax')}</div>
      </div>`;
    canvasChart('gw-rew',{type:'line',labels:[],datasets:[
      {label:'Episode Reward',data:[],color:'#157a5e',width:2,dots:true,fill:'rgba(21,122,94,.07)'}
    ],refLines:[{value:0,color:'rgba(18,23,43,.25)'}]});
  } else {
    area.innerHTML=`
      <div class="chart-grid cols-2" style="margin-bottom:12px">
        <div class="chart-box"><h4>Q Estimates per Arm</h4>${cv('ep-arms')}</div>
        <div class="chart-box"><h4>Epsilon Decay</h4>${cv('ep-eps')}</div>
      </div>
      <div class="chart-grid cols-2">
        <div class="chart-box"><h4>Cumulative Reward</h4>${cv('ep-cum')}</div>
        <div class="chart-box"><h4>Cumulative Regret</h4>${cv('ep-reg')}</div>
      </div>`;
  }
}

/* ------------------------------------------------
   Dispatch to the right renderer for the current mode
   ------------------------------------------------ */
function renderCharts(){
  const s = stepsData[cur];
  if(!s) return;
  if(mode==='intro') renderIntroScene(s);
  else if(mode==='basics') renderBasicsCharts(s);
  else if(mode==='qlearning') renderQLCharts(s);
  else if(mode==='gridworld') renderGWCharts(s);
  else renderEpsCharts(s);
}

/* ------------------------------------------------
   RL Basics charts
   ------------------------------------------------ */
function renderBasicsCharts(s){
  const allLabels = stepsData.map((_,i)=>i);
  const allRewards = stepsData.map((x,i)=>i<=cur?(x.totalR||0):null);
  const knownRewards = allRewards.filter(v=>v!==null);
  canvasChart('b-reward',{type:'line',labels:allLabels,yMin:Math.min(...knownRewards,0)-1,datasets:[
    {label:'Cumulative Reward',data:allRewards,color:'#157a5e',width:2,dots:true,fill:'rgba(21,122,94,.08)'}
  ]});
  const rews=[0,-0.1,-0.1,-0.1,-0.1,10,0,0];
  const fullRews = allLabels.map(i=>i<=cur?(rews[i]??0):null);
  canvasChart('b-sar',{type:'bar',labels:allLabels.map(i=>'S'+i),yMin:Math.min(...rews)-0.5,datasets:[
    {data:fullRews,color:fullRews.map(v=>v===null?'transparent':v>0?'rgba(21,122,94,.7)':v<0?'rgba(193,56,44,.6)':'rgba(44,75,219,.4)')}
  ]});
}

/* ------------------------------------------------
   Q-Learning charts + Q-table DOM render
   ------------------------------------------------ */
function renderQLCharts(s){
  const cfg = s.cfg;
  const allLabels = stepsData.map((_,i)=>i);
  const colors=['#2c4bdb','#157a5e','#a8710f','#6338bf','#c1382c','#bb5620','#a3306f'];

  const combos=[];
  cfg.states.forEach((st,si)=>{ cfg.actions.forEach((ac,ai)=>{ combos.push({si,ai,label:`Q(${st.split('\n')[0]},${ac})`}); }); });
  const datasets=combos.map((c,i)=>({
    label:c.label,
    data:allLabels.map((_,idx)=>idx<=cur?(stepsData[idx].Q[c.si]?stepsData[idx].Q[c.si][c.ai]:0):null),
    color:colors[i%colors.length],width:1.5,dots:false
  }));
  canvasChart('ql-qvals',{type:'line',labels:allLabels,legend:true,datasets});

  const allDeltas = allLabels.map((_,idx)=>idx<=cur?(stepsData[idx].delta||0):null);
  canvasChart('ql-delta',{type:'bar',labels:allLabels,datasets:[
    {data:allDeltas,color:allDeltas.map(d=>d===null?'transparent':d>0?'rgba(21,122,94,.65)':d<0?'rgba(193,56,44,.65)':'rgba(44,75,219,.4)')}
  ]});

  const tbl = document.getElementById('qtable');
  if(tbl){
    let html=`<thead><tr><th>State</th>${cfg.actions.map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>`;
    s.Q.forEach((row,si)=>{
      const hl = si===s.s?'cur':'';
      const best = Math.max(...row);
      html+=`<tr class="${hl}"><td>${cfg.states[si]}</td>`;
      row.forEach((v,ai)=>{
        const col = v===best&&v!==0?'color:var(--green);font-weight:700':v<0?'color:var(--red)':'';
        html+=`<td style="${col}">${v.toFixed(3)}</td>`;
      });
      html+='</tr>';
    });
    html+='</tbody>';
    tbl.innerHTML=html;
  }
}

/* ------------------------------------------------
   Grid World charts + grid DOM render
   ------------------------------------------------ */
function renderGWCharts(s){
  const N=s.N, gwDiv=document.getElementById('gwGrid');
  if(gwDiv){
    const EMOJI={goal:'🏆',trap:'⚠️',wall:'⛔',agent:'🤖',start:'🚀'};
    gwDiv.innerHTML='';
    gwDiv.style.gridTemplateColumns=`repeat(${N},1fr)`;
    gwDiv.className='gridworld';
    for(let i=0;i<N*N;i++){
      const cell=document.createElement('div');
      const isAgent=i===s.agentState, isGoal=i===s.goalState, isTrap=s.trapStates.includes(i), isWall=s.wallStates.includes(i), isStart=i===0;
      const visits=s.visitCounts[i];
      cell.className='grid-cell '+(isWall?'cell-wall':isGoal?'cell-goal':isTrap?'cell-trap':isAgent?'cell-agent':visits>0?'cell-visited':'cell-normal');
      const maxQ=Math.max(...s.Q[i]);
      const icon=isAgent?EMOJI.agent:isGoal?EMOJI.goal:isTrap?EMOJI.trap:isWall?EMOJI.wall:isStart?EMOJI.start:'';
      cell.innerHTML=`${icon}<div class="q-mini">${isWall?'':maxQ.toFixed(1)}</div>`;
      gwDiv.appendChild(cell);
    }
  }

  const totalEps = stepsData.filter(x=>x.isTerminal).length;
  const allEpLabels = Array.from({length:totalEps},(_,i)=>i+1);
  const epData = stepsData.slice(1,cur+1).filter(x=>x.isTerminal).map(x=>({ep:x.episode,r:x.totalR}));
  const allEpRewards = allEpLabels.map(ep=>{ const d=epData.find(x=>x.ep===ep); return d!=null?d.r:null; });
  canvasChart('gw-rew',{type:'line',labels:allEpLabels,datasets:[
    {label:'Episode Reward',data:allEpRewards,color:'#157a5e',width:2,dots:true,fill:'rgba(21,122,94,.07)'}
  ],refLines:[{value:0,color:'rgba(18,23,43,.25)'}]});
  canvasChart('gw-visits',{type:'bar',labels:stepsData[0]?Array.from({length:s.N*s.N},(_,i)=>'s'+i):[],datasets:[
    {data:s.visitCounts,color:'rgba(99,56,191,.65)'}
  ]});
  canvasChart('gw-qmax',{type:'bar',labels:Array.from({length:s.N*s.N},(_,i)=>'s'+i),datasets:[
    {data:s.Q.map(row=>Math.max(...row)),color:s.Q.map(row=>Math.max(...row)>5?'rgba(21,122,94,.7)':Math.max(...row)<0?'rgba(193,56,44,.6)':'rgba(44,75,219,.5)')}
  ]});
}

/* ------------------------------------------------
   Epsilon-greedy exploration charts
   ------------------------------------------------ */
function renderEpsCharts(s){
  const trueVals=s.trueValues, labels=s.labels;
  canvasChart('ep-arms',{type:'bar',labels,datasets:[
    {data:trueVals,color:'rgba(44,75,219,.3)',label:'True Value'},
    {data:s.Q,color:s.Q.map((_,i)=>i===s.chosen?'rgba(168,113,15,.9)':'rgba(99,56,191,.65)'),label:'Q Estimate'},
  ],legend:true,yMin:0});

  const allStepLabels = stepsData.map((_,i)=>i);
  const allEps = allStepLabels.map((_,idx)=>idx<=cur?(stepsData[idx].epsilon||0):null);
  canvasChart('ep-eps',{type:'line',labels:allStepLabels,datasets:[
    {data:allEps,color:'#bb5620',width:2,fill:'rgba(187,86,32,.08)',dots:false}
  ],yMin:0,yMax:1});

  const maxCumLen = Math.max(...stepsData.map(x=>(x.cumulativeRs||[]).length));
  const cumLabels = Array.from({length:maxCumLen},(_,i)=>i+1);
  const curCumRs = s.cumulativeRs||[0];
  const fullCumRs = cumLabels.map((_,i)=>i<curCumRs.length?curCumRs[i]:null);
  canvasChart('ep-cum',{type:'line',labels:cumLabels,datasets:[
    {data:fullCumRs,color:'#157a5e',width:2,fill:'rgba(21,122,94,.08)'}
  ]});

  const maxRegLen = Math.max(...stepsData.map(x=>(x.regrets||[]).length));
  const regLabels = Array.from({length:maxRegLen},(_,i)=>i+1);
  const curRegs = s.regrets||[0];
  const fullRegs = regLabels.map((_,i)=>i<curRegs.length?curRegs[i]:null);
  canvasChart('ep-reg',{type:'line',labels:regLabels,datasets:[
    {data:fullRegs,color:'#c1382c',width:2,fill:'rgba(193,56,44,.07)'}
  ]});
}

/* ------------------------------------------------
   Intro: agent <-> environment loop diagram.
   Highlights the part being explained this step.
   ------------------------------------------------ */
function renderIntroScene(s){
  const el=document.getElementById('loopDiagram'); if(!el||!s.ex) return;
  const f=s.focus||'none', all=(f==='loop');
  const on=k=>(all||f===k)?' on':'';
  const ex=s.ex;
  el.className='loop';
  el.innerHTML=`
    <div class="loop-node${on('agent')}"><div class="ln-ico">${ex.aI}</div><b>Agent</b><span class="sub">${ex.agent}</span></div>
    <div class="loop-arrows">
      <div class="loop-arrow act${on('action')}">Action → <em>${ex.action}</em></div>
      <div class="loop-arrow st${on('state')}">← State: <em>${ex.state}</em></div>
      <div class="loop-arrow rw${on('reward')}">← Reward: <em>${ex.reward}</em></div>
    </div>
    <div class="loop-node env${on('env')}"><div class="ln-ico">${ex.eI}</div><b>Environment</b><span class="sub">${ex.env}</span></div>`;
  const note=document.getElementById('loopNote');
  if(note) note.textContent=ex.note;
}
