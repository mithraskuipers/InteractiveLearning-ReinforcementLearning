/* ================================================
   DATA BUILDERS
   Pure functions — no DOM access. Each returns an
   array of step objects consumed by the UI layer.
   ================================================ */

/* Seeded RNG (Mulberry32-lite) — deterministic replays */
function rng(seed){ let s=seed%2147483647; if(s<=0)s+=2147483646; return ()=>{ s=s*16807%2147483647; return (s-1)/2147483646; }; }

/* ------------------------------------------------
   RL BASICS
   ------------------------------------------------ */
function buildBasics(sc){
  const scenarios = {
    robot: {
      name: 'Robot Navigation',
      steps: [
        { title:'The RL Framework', formula:'Agent → Action → Environment → (State, Reward) → Agent',
          explain:'Reinforcement Learning is about an <strong>agent</strong> learning to act in an <strong>environment</strong> to maximize cumulative <strong>reward</strong>. Unlike supervised learning, there are no labels — the agent discovers what works through trial and error.',
          chips:[['State','s₀ = Start Room','c-s'],['Action','','c-a'],['Reward','','c-r'],['Return','','c-q']],
          ep:0, step:0, totalR:0, action:'', reward:'', nextState:'' },
        { title:'State: Where Am I?', formula:'State s ∈ S — full description of environment',
          explain:'The <strong>state</strong> captures everything the agent needs to know to make a decision. For our robot: current room number. State s₀ = Room 0 (Start).',
          chips:[['State','Room 0','c-s'],['Actions','↑↓←→','c-a'],['Reward','','c-r'],['Total R','0','c-r']],
          ep:0, step:0, totalR:0, action:'', reward:'', nextState:'' },
        { title:'Action: What Do I Do?', formula:'Action a ∈ A(s) — chosen from the policy π(s)',
          explain:'The agent picks action <strong>a = "move right"</strong> based on its current policy. Early on the policy is random (exploration). Over time it improves.',
          chips:[['State','Room 0','c-s'],['Action','→ Right','c-a'],['Reward','','c-r'],['Total R','0','c-r']],
          ep:0, step:1, totalR:0, action:'→ Right', reward:'', nextState:'' },
        { title:'Reward: Feedback Signal', formula:'Reward r = R(s,a,s\') — scalar feedback from environment',
          explain:'After taking action "right", the robot moves to <strong>Room 1</strong> and receives a small reward <strong>r = −0.1</strong> (step cost). The environment says: "you moved, but haven\'t reached the goal yet."',
          chips:[['State','Room 1','c-s'],['Action','→ Right','c-a'],['Reward','−0.1','c-r'],['Total R','−0.1','c-r']],
          ep:0, step:2, totalR:-0.1, action:'→ Right', reward:'-0.1', nextState:'Room 1' },
        { title:'Episode Continues…', formula:'Trajectory: s₀,a₀,r₁,s₁,a₁,r₂,s₂,…,sT',
          explain:'The robot keeps exploring. Another right → Room 2 (r=−0.1). Then up → Room 3 (r=−0.1). The <strong>episode</strong> is a full sequence from start to terminal state.',
          chips:[['State','Room 3','c-s'],['Action','↑ Up','c-a'],['Reward','−0.1','c-r'],['Total R','−0.3','c-r']],
          ep:0, step:4, totalR:-0.3, action:'↑ Up', reward:'-0.1', nextState:'Room 3' },
        { title:'Goal Reached — Reward!', formula:'Terminal state: r_goal = +10.0 (sparse reward)',
          explain:'The robot reaches the <strong>Goal Room</strong> and receives a large positive reward <strong>r = +10</strong>. Total episode return = <strong>+9.7</strong>. This positive signal tells the agent this path was good!',
          chips:[['State','GOAL','c-q'],['Action','→ Right','c-a'],['Reward','+10','c-r'],['Total R','9.7','c-r']],
          ep:0, step:5, totalR:9.7, action:'→ Right', reward:'+10.0', nextState:'GOAL' },
        { title:'Return: Discounted Sum', formula:'G_t = r_{t+1} + γ·r_{t+2} + γ²·r_{t+3} + … = Σ γᵏ·r_{t+k+1}',
          explain:'The <strong>return G</strong> sums all future rewards, discounted by γ (here γ=0.9). Reward now is worth more than reward later. This is how agents plan ahead rather than just greedily taking the immediate reward.',
          chips:[['γ','0.9','c-q'],['r₁','−0.1','c-r'],['r₅','+10','c-r'],['G₀','≈9.7','c-q']],
          ep:0, step:5, totalR:9.7, action:'', reward:'', nextState:'' },
        { title:'Policy: The Agent\'s Brain', formula:'π(a|s) — prob of action a in state s. Optimal: π*(s) = argmax_a Q*(s,a)',
          explain:'The <strong>policy π</strong> maps states to actions. A random policy explores everywhere. An optimal policy always picks the action with the highest expected return. Q-Learning learns this optimal policy automatically!',
          chips:[['Policy','π*(s)','c-q'],['Value','V*(s)','c-q'],['Q-Value','Q*(s,a)','c-q'],['Bellman','✓','c-s']],
          ep:0, step:5, totalR:9.7, action:'', reward:'', nextState:'' },
      ]
    },
    game: {
      name: 'Game Agent',
      steps: [
        { title:'The RL Framework', formula:'Agent → Action → Environment → (State, Reward) → Agent',
          explain:'In a video game, the <strong>agent</strong> is the player (AI). The <strong>environment</strong> is the game engine. The agent sees frames (state), picks actions (buttons), and receives score changes (reward). Classic RL setup!',
          chips:[['State','Game Frame','c-s'],['Action','','c-a'],['Reward','','c-r'],['Score','0','c-r']],
          ep:0, step:0, totalR:0, action:'', reward:'', nextState:'' },
        { title:'State Space', formula:'State: pixels, health, position, enemy locations, …',
          explain:'The state can be raw pixel data (like DQN) or structured features. Here: [player_x, player_y, enemy_x, enemy_y, health]. Compact state = faster learning.',
          chips:[['Player','(3,5)','c-s'],['Enemy','(7,5)','c-s'],['Health','100','c-s'],['Score','0','c-r']],
          ep:0, step:0, totalR:0, action:'', reward:'', nextState:'' },
        { title:'Action: Shoot!', formula:'A = {left, right, up, down, shoot, jump}',
          explain:'The agent picks <strong>Shoot</strong>. The enemy is at distance 4 — bullet fired! Action space is discrete here (6 possible actions). In continuous control (robotics) actions can be real-valued.',
          chips:[['State','[3,5,7,5,100]','c-s'],['Action','SHOOT','c-a'],['Reward','','c-r'],['Score','0','c-r']],
          ep:0, step:1, totalR:0, action:'SHOOT', reward:'', nextState:'' },
        { title:'Hit! Reward +10', formula:'r = +10 (enemy eliminated)',
          explain:'Enemy eliminated! <strong>r = +10</strong>. The environment gives a positive reward, reinforcing the shoot action in this state. The agent learns this (state, action) pair is valuable.',
          chips:[['State','[3,5,*,*,100]','c-s'],['Action','SHOOT','c-a'],['Reward','+10','c-r'],['Score','10','c-r']],
          ep:0, step:2, totalR:10, action:'SHOOT', reward:'+10', nextState:'enemy gone' },
        { title:'Step Penalty', formula:'r = −0.01 per step (encourages efficiency)',
          explain:'Each step without progress costs −0.01. This <strong>step penalty</strong> teaches the agent to be efficient — reach goals quickly, don\'t wander. Without it, agents often learn to stall.',
          chips:[['Steps','3','c-a'],['Step Cost','−0.01','c-red'],['Net Reward','+9.97','c-r'],['Efficiency','Goal!','c-q']],
          ep:1, step:3, totalR:9.97, action:'→ Move', reward:'-0.01', nextState:'' },
        { title:'Death Penalty', formula:'r = −100 (terminal, negative reward)',
          explain:'If the agent takes damage and dies: <strong>r = −100</strong>. Strong negative rewards signal catastrophic outcomes. The agent quickly learns to avoid these states — negative reinforcement.',
          chips:[['Health','0','c-red'],['Reward','−100','c-red'],['Episode','Ended','c-red'],['Lesson','Avoid death!','c-q']],
          ep:1, step:4, totalR:-90, action:'→ Walk into enemy', reward:'-100', nextState:'DEAD' },
        { title:'Learning Across Episodes', formula:'Policy improves: E[G] ↑ as episodes → ∞',
          explain:'After many episodes, the agent\'s policy improves. Episode 1: score 10. Episode 10: score 80. Episode 100: score 450. The agent has learned to dodge, aim, and plan routes. This is RL in action!',
          chips:[['Ep 1','Score 10','c-red'],['Ep 10','Score 80','c-a'],['Ep 100','Score 450','c-r'],['Ep 500','Score 890','c-q']],
          ep:100, step:0, totalR:450, action:'', reward:'', nextState:'' },
      ]
    },
    trader: {
      name: 'Trading Agent',
      steps: [
        { title:'The RL Framework', formula:'Agent → Action → Market → (Portfolio State, P&L) → Agent',
          explain:'A trading agent observes <strong>market state</strong> (prices, indicators, position), picks an <strong>action</strong> (buy/sell/hold), and receives <strong>reward</strong> as profit & loss (P&L). It learns a trading strategy purely from market feedback.',
          chips:[['Capital','$10,000','c-s'],['Position','None','c-s'],['Action','','c-a'],['P&L','$0','c-r']],
          ep:0, step:0, totalR:0, action:'', reward:'', nextState:'' },
        { title:'State: Market Observation', formula:'State: [price, MA5, MA20, RSI, position, unrealised_pnl]',
          explain:'The state captures market context. Here: price=105, 5-day MA=103, 20-day MA=100, RSI=62, position=0 (flat). The agent sees a potential upward trend.',
          chips:[['Price','$105','c-s'],['MA5','$103','c-s'],['RSI','62','c-s'],['Position','Flat','c-a']],
          ep:0, step:0, totalR:0, action:'', reward:'', nextState:'' },
        { title:'Action: BUY', formula:'a = BUY: enter long position, cost = spread + commission',
          explain:'The agent acts: <strong>BUY 1 unit</strong> at $105. Transaction cost = $0.10 (spread + commission). Immediate reward = <strong>−$0.10</strong> (cost of entry). The agent now has a long position.',
          chips:[['Position','Long','c-a'],['Entry','$105.00','c-s'],['Cost','−$0.10','c-red'],['Unrealised','$0','c-r']],
          ep:0, step:1, totalR:-0.10, action:'BUY @ 105', reward:'-$0.10', nextState:'Long' },
        { title:'Price Moves Up', formula:'r = (price_t - price_{t-1}) × position = Δprice × 1',
          explain:'Next period: price rises to $107. <strong>Reward = +$2.00</strong> (unrealised gain). The agent is rewarded in proportion to price movement while holding a long position. Good learning signal!',
          chips:[['Price','$107','c-s'],['Position','Long','c-a'],['Reward','+$2.00','c-r'],['Cumulative','+$1.90','c-r']],
          ep:0, step:2, totalR:1.90, action:'HOLD', reward:'+$2.00', nextState:'Long' },
        { title:'Action: SELL (Close)', formula:'r = (sell_price − entry_price) − costs',
          explain:'Price reaches $110. Agent acts: <strong>SELL</strong> to close. Total P&L = $(110−105) − $0.20 costs = <strong>+$4.80</strong> profit. Episode total: +$4.70. The agent is learning when to take profits.',
          chips:[['Exit','$110.00','c-r'],['Gross P&L','+$5.00','c-r'],['Net P&L','+$4.80','c-r'],['Episode','↑ Good','c-q']],
          ep:0, step:3, totalR:4.70, action:'SELL @ 110', reward:'+$4.80', nextState:'Flat' },
        { title:'Risk: Drawdown Penalty', formula:'r -= λ × max_drawdown (risk-adjusted reward)',
          explain:'In episode 3, the agent holds through a −$5 drawdown before recovering. A <strong>risk penalty</strong> discourages large losses even if eventually profitable. Sharpe-ratio reward shaping teaches risk management.',
          chips:[['Drawdown','−$5.00','c-red'],['Risk Pen.','−$1.00','c-red'],['Net Ep.','−$0.20','c-red'],['Lesson','Manage risk!','c-q']],
          ep:3, step:0, totalR:-0.20, action:'HOLD', reward:'−$1.00 pen.', nextState:'' },
        { title:'Policy Converges', formula:'Optimal π*: buy dips, sell strength, limit drawdown',
          explain:'After 200+ episodes the agent develops a real strategy: buys when RSI < 40 (oversold), sells when RSI > 70, limits position size to control drawdown. The policy emerged purely from reward signals — no human rules!',
          chips:[['Strategy','RSI-based','c-q'],['Win Rate','58%','c-r'],['Avg Ep.','+$3.20','c-r'],['Sharpe','1.42','c-q']],
          ep:200, step:0, totalR:640, action:'', reward:'', nextState:'' },
      ]
    }
  };
  return scenarios[sc].steps.map((s,i)=>({...s, step:i}));
}

/* ------------------------------------------------
   Q-LEARNING
   ------------------------------------------------ */
function buildQLearning(sc, alpha, gamma){
  const eps = [
    {name:'3-State Chain', states:['S0\n(Start)','S1\n(Mid)','S2\n(Goal)'], initQ:[[0,0],[0,0],[0,0]], trajectory:[
      {s:0,a:1,r:-0.1,ns:1},{s:1,a:1,r:-0.1,ns:2},{s:2,a:0,r:10,ns:2,'terminal':true},
      {s:0,a:1,r:-0.1,ns:1},{s:1,a:1,r:-0.1,ns:2},{s:2,a:0,r:10,ns:2,'terminal':true},
    ], actions:['←','→'], goalState:2, trapState:-1 },
    {name:'4-State Maze', states:['Start','Corridor','Room','Goal'], initQ:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]], trajectory:[
      {s:0,a:1,r:-0.1,ns:1},{s:1,a:2,r:-0.1,ns:2},{s:2,a:1,r:-0.5,ns:1},{s:1,a:2,r:-0.1,ns:2},{s:2,a:2,r:10,ns:3,'terminal':true},
      {s:0,a:1,r:-0.1,ns:1},{s:1,a:2,r:-0.1,ns:2},{s:2,a:2,r:10,ns:3,'terminal':true},
    ], actions:['←','→','↑'], goalState:3, trapState:-1 },
    {name:'Cliff Walk', states:['Safe A','Safe B','Cliff!','Goal'], initQ:[[0,0],[0,0],[0,0],[0,0]], trajectory:[
      {s:0,a:1,r:-0.1,ns:1},{s:1,a:1,r:-100,ns:2,'trap':true},{s:0,a:1,r:-0.1,ns:1},{s:1,a:0,r:-0.1,ns:0},{s:0,a:1,r:-0.1,ns:1},{s:1,a:1,r:-100,ns:2,'trap':true},
      {s:0,a:0,r:-0.1,ns:0},{s:0,a:1,r:-0.1,ns:1},{s:1,a:0,r:-0.1,ns:0},{s:0,a:1,r:-0.1,ns:1},{s:1,a:1,r:10,ns:3,'terminal':true},
    ], actions:['←','→'], goalState:3, trapState:2 },
  ];
  const cfg = eps[sc==='simple'?0:sc==='maze'?1:2];

  const Q = cfg.initQ.map(row=>[...row]);
  const steps = [];

  steps.push({
    title: 'Q-Table Initialized',
    formula: 'Q(s,a) = 0 for all s,a — start with no knowledge',
    explain: `<strong>Q-Learning</strong> maintains a table Q[state][action] = expected future reward. We initialize all values to 0 — the agent starts completely ignorant. States: ${cfg.states.join(', ')}. Actions: ${cfg.actions.join(', ')}.`,
    Q: Q.map(r=>[...r]), s:-1, a:-1, r:0, ns:-1, delta:0, episode:1, epStep:0, totalR:0, isTerminal:false, isTrap:false,
    chips:[['α (alpha)', alpha.toFixed(1),'c-a'],['γ (gamma)',gamma.toFixed(1),'c-q'],['ε','1.0 (explore)','c-e'],['States',cfg.states.length,'c-s']],
    cfg
  });

  let episode = 1, epStep = 0, totalR = 0, epsilon = 1.0;
  for(let t=0; t<cfg.trajectory.length; t++){
    const {s,a,r,ns} = cfg.trajectory[t];
    const trap = !!cfg.trajectory[t].trap;
    const terminal = !!cfg.trajectory[t].terminal || trap;
    const oldQ = Q[s][a];
    const maxNextQ = terminal ? 0 : Math.max(...Q[ns]);
    const delta = r + gamma * maxNextQ - oldQ;
    Q[s][a] = +(oldQ + alpha * delta).toFixed(4);
    totalR += r;
    epStep++;
    epsilon = Math.max(0.05, epsilon * 0.82);

    steps.push({
      title: trap ? '💥 Cliff! Q gets negative update' : terminal ? `✅ Episode ${episode} complete!` : `Episode ${episode}, Step ${epStep}`,
      formula: `Q(s${s},a${a}) ← ${oldQ.toFixed(3)} + ${alpha}×[${r} + ${gamma}×${maxNextQ.toFixed(3)} − ${oldQ.toFixed(3)}] = <strong>${Q[s][a]}</strong>`,
      explain: trap
        ? `<strong>Trap!</strong> Agent falls off cliff. r = <span class="rd">${r}</span>. Q update: Q(${cfg.states[s]}, ${cfg.actions[a]}) = <span class="rd">${Q[s][a]}</span>. This large negative value will deter this action in future!`
        : terminal
        ? `<strong>Goal reached!</strong> Episode ${episode} total reward = <span class="gn">${totalR.toFixed(1)}</span>. Q(${cfg.states[s]}, ${cfg.actions[a]}) updated to <span class="gn">${Q[s][a]}</span>. The agent's knowledge is growing.`
        : `State <strong>${cfg.states[s]}</strong> → Action <span class="gd">${cfg.actions[a]}</span> → State <strong>${cfg.states[ns]}</strong>, reward <span class="${r<0?'rd':'gn'}">${r}</span>. <br>TD error δ = ${delta.toFixed(4)}. Q updated by α×δ = <span class="ac">${(alpha*delta).toFixed(4)}</span>.`,
      Q: Q.map(rr=>[...rr]),
      s, a, r, ns, delta: +delta.toFixed(4),
      episode, epStep, totalR: +totalR.toFixed(2),
      isTerminal: terminal, isTrap: trap,
      epsilon: +epsilon.toFixed(3),
      cfg,
      chips:[
        ['State', cfg.states[s]||'','c-s'],
        ['Action', cfg.actions[a]||'','c-a'],
        ['Reward', r,'c-r'],
        ['TD Error', delta.toFixed(3),'c-q'],
        ['ε', epsilon.toFixed(3),'c-e'],
        ['Ep Total', totalR.toFixed(1),'c-r'],
      ]
    });

    if(terminal){ episode++; epStep=0; totalR=0; }
  }

  return steps;
}

/* ------------------------------------------------
   GRID WORLD
   ------------------------------------------------ */
function buildGridWorld(size, episodes){
  const N = size;
  const goalState = N*N-1;
  const trapStates = N===3 ? [4] : N===4 ? [5,10] : [6,12,18];
  const wallStates = N===5 ? [7,17] : [];
  const alpha=0.5, gamma=0.9;
  const ACTIONS = [[-1,0,'↑'],[1,0,'↓'],[0,-1,'←'],[0,1,'→']];

  const Q = Array.from({length:N*N},()=>[0,0,0,0]);
  const visitCounts = new Array(N*N).fill(0);
  const steps = [];
  let totalSteps = 0;

  function stateToRC(s){ return [Math.floor(s/N), s%N]; }
  function rcToState(r,c){ return r*N+c; }
  function validMoves(s){
    const [r,c] = stateToRC(s);
    return ACTIONS.map(([dr,dc,sym],i)=>{
      const nr=r+dr, nc=c+dc;
      if(nr<0||nr>=N||nc<0||nc>=N) return null;
      const ns=rcToState(nr,nc);
      if(wallStates.includes(ns)) return null;
      return {action:i, ns, sym};
    }).filter(Boolean);
  }

  steps.push({
    title:'Grid World — Initial State',
    explain:`A <strong>${N}×${N} grid world</strong>. Agent starts top-left (S0). Goal: reach bottom-right 🏆 (+10). Traps: ⚠️ cells (−5). Walls: ⛔ blocked. The agent learns optimal path via Q-Learning.`,
    formula:`Grid: ${N}×${N} = ${N*N} states. Actions: ↑↓←→. R(goal) = +10, R(trap) = −5, R(step) = −0.1`,
    Q: Q.map(r=>[...r]), agentState:0, visitCounts:[...visitCounts],
    episode:0, epStep:0, totalR:0, isTerminal:false,
    trapStates, wallStates, goalState, N,
    chips:[['Grid',`${N}×${N}`,'c-s'],['States',N*N,'c-s'],['Goal','s'+(goalState),'c-q'],['Traps',trapStates.length,'c-red']]
  });

  const rng_ = rng(42);
  for(let ep=1; ep<=episodes; ep++){
    let s=0, epStep=0, epR=0;
    const epsilon = Math.max(0.05, 1-ep/episodes*1.2);
    for(let step=0; step<N*N*3; step++){
      const moves = validMoves(s);
      if(!moves.length) break;
      let chosen;
      if(rng_()<epsilon){
        chosen = moves[Math.floor(rng_()*moves.length)];
      } else {
        let best=-Infinity;
        for(const m of moves){ if(Q[s][m.action]>best){best=Q[s][m.action];chosen=m;} }
      }
      const {action, ns} = chosen;
      visitCounts[s]++;
      const isTrap = trapStates.includes(ns);
      const isGoal = ns===goalState;
      const r = isGoal ? 10 : isTrap ? -5 : -0.1;
      epR += r; epStep++; totalSteps++;
      const maxNextQ = (isGoal||isTrap) ? 0 : Math.max(...Q[ns]);
      const delta = r + gamma*maxNextQ - Q[s][action];
      Q[s][action] = +(Q[s][action] + alpha*delta).toFixed(4);

      const record = ep<=3 || isGoal || isTrap || (ep%Math.max(1,Math.floor(episodes/4))===0 && epStep<=2);
      if(record){
        steps.push({
          title: isGoal ? `✅ Ep ${ep}: Goal reached in ${epStep} steps!` : isTrap ? `⚠️ Ep ${ep}: Trap! Step ${epStep}` : `Ep ${ep}, Step ${epStep}`,
          explain: isGoal
            ? `Episode ${ep} complete! Agent reached the goal in <strong>${epStep} steps</strong>, total reward <span class="gn">${epR.toFixed(1)}</span>. Q-values are updating; the optimal path is becoming clearer each episode.`
            : isTrap
            ? `Agent stepped into a <strong>trap</strong> at s${ns}! r = <span class="rd">${r}</span>. TD error = <span class="rd">${delta.toFixed(3)}</span>. Q(s${s}, ${ACTIONS[action][2]}) updated to <span class="rd">${Q[s][action]}</span>. The agent will avoid this next time.`
            : `State s${s} (${ACTIONS[action][2]}) → s${ns}. r = <span class="${r<0?'rd':'gn'}">${r}</span>. δ = ${delta.toFixed(3)}. Q(s${s},${ACTIONS[action][2]}) → <span class="ac">${Q[s][action]}</span>. ε=${epsilon.toFixed(2)} (${epsilon>0.5?'mostly exploring':'mostly exploiting'}).`,
          formula: `Q(s${s},${ACTIONS[action][2]}) ← ${(Q[s][action]-alpha*delta).toFixed(3)} + ${alpha}×[${r} + ${gamma}×${maxNextQ.toFixed(2)} − ${(Q[s][action]-alpha*delta).toFixed(3)}] = ${Q[s][action]}`,
          Q: Q.map(r=>[...r]), agentState:ns, visitCounts:[...visitCounts],
          episode:ep, epStep, totalR:+epR.toFixed(2), isTerminal:isGoal||isTrap,
          trapStates, wallStates, goalState, N, epsilon:+epsilon.toFixed(3),
          chips:[
            ['Episode',ep,'c-s'],['Step',epStep,'c-a'],
            ['Reward',r,'c-r'],['ε',epsilon.toFixed(2),'c-e'],
            ['Ep Total',epR.toFixed(1),'c-r'],['Q Updated',Q[s][action],'c-q']
          ]
        });
      }
      s = ns;
      if(isGoal||isTrap) break;
    }
  }
  return steps;
}

/* ------------------------------------------------
   EPSILON-GREEDY EXPLORATION
   ------------------------------------------------ */
function buildEpsilon(sc, epStart, epDecay){
  const scenarios = {
    bandit: {
      name:'5-Arm Bandit',
      arms:[1.5,3.0,0.5,4.2,2.1],
      labels:['Arm 1','Arm 2','Arm 3','Arm 4★','Arm 5'],
    },
    maze: {
      name:'Maze Explorer',
      arms:[0.8,2.5,1.2,3.8,0.3],
      labels:['Path A','Path B','Path C','Path D★','Path E'],
    }
  };
  const cfg = scenarios[sc];
  const nArms = cfg.arms.length;
  const Q_arms = new Array(nArms).fill(0);
  const counts = new Array(nArms).fill(0);
  const rng_ = rng(7);
  const steps = [];

  steps.push({
    title:'The Exploration-Exploitation Dilemma',
    explain:`<strong>Exploration vs. Exploitation</strong>: Should the agent try new actions (explore) or stick with what works (exploit)? Too much exploitation = stuck in local optima. Too much exploration = never converges. <strong>ε-greedy</strong> solves this with a decaying exploration rate.`,
    formula:'With prob ε: random action (explore). With prob 1−ε: best known action (exploit)',
    epsilon:epStart, Q:[...Q_arms], counts:[...counts], t:0, chosen:-1, reward:0, isExplore:false,
    cumulativeR:0, bestArm:3, trueValues:cfg.arms, labels:cfg.labels,
    chips:[['ε','1.0','c-e'],['Best Arm','Unknown','c-red'],['Steps','0','c-s'],['Regret','0','c-red']]
  });

  let epsilon = epStart, cumR=0, bestKnown=-Infinity, bestKnownArm=-1, totalRegret=0;
  const cumulativeRs=[], epsilons=[], regrets=[];

  for(let t=1; t<=30; t++){
    epsilon = Math.max(0.01, epsilon * epDecay);
    const isExplore = rng_()<epsilon;
    let arm;
    if(isExplore){ arm = Math.floor(rng_()*nArms); }
    else { arm = Q_arms.indexOf(Math.max(...Q_arms)); }

    const r = +(cfg.arms[arm] + (rng_()*2-1)*0.8).toFixed(2);
    counts[arm]++;
    Q_arms[arm] = +(Q_arms[arm] + (r-Q_arms[arm])/counts[arm]).toFixed(3);
    cumR += r;
    const regret = cfg.arms[3] - cfg.arms[arm];
    totalRegret += Math.max(0, regret);
    cumulativeRs.push(+cumR.toFixed(2));
    epsilons.push(+epsilon.toFixed(3));
    regrets.push(+totalRegret.toFixed(2));

    if(Q_arms[arm]>bestKnown){ bestKnown=Q_arms[arm]; bestKnownArm=arm; }

    if(t<=10 || t%5===0){
      steps.push({
        title: isExplore ? `Step ${t}: 🎲 EXPLORE (ε=${epsilon.toFixed(2)})` : `Step ${t}: 🎯 EXPLOIT (ε=${epsilon.toFixed(2)})`,
        explain: isExplore
          ? `Random exploration! Tried <strong>${cfg.labels[arm]}</strong>, got reward <span class="gd">${r}</span>. Q estimate updated to <span class="ac">${Q_arms[arm]}</span>. Exploring gives us information about arms we haven't tried much.`
          : `Exploiting best known arm: <strong>${cfg.labels[arm]}</strong> (Q=${Q_arms[arm]}). Got reward <span class="gn">${r}</span>. Cumulative reward = <span class="gn">${cumR.toFixed(2)}</span>. ${arm===3?'🏆 Optimal arm selected!':'Suboptimal arm — still learning...'}`,
        formula: `Q(arm${arm}) ← Q(arm${arm}) + (${r} − Q(arm${arm})) / ${counts[arm]} = ${Q_arms[arm]}`,
        epsilon:+epsilon.toFixed(3), Q:[...Q_arms], counts:[...counts], t,
        chosen:arm, reward:r, isExplore, cumulativeR:+cumR.toFixed(2),
        bestArm:3, trueValues:cfg.arms, labels:cfg.labels,
        cumulativeRs:[...cumulativeRs], epsilons:[...epsilons], regrets:[...regrets],
        totalRegret:+totalRegret.toFixed(2),
        chips:[
          ['ε',epsilon.toFixed(3),'c-e'],
          ['Action',isExplore?'EXPLORE':'EXPLOIT',isExplore?'c-e':'c-q'],
          ['Reward',r,'c-r'],
          ['Best Arm',cfg.labels[bestKnownArm]||'?','c-q'],
          ['Cumulative',cumR.toFixed(1),'c-r'],
          ['Regret',totalRegret.toFixed(2),'c-red'],
        ]
      });
    }
  }
  return steps;
}
