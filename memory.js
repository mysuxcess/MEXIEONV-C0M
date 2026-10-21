const agentMemory = JSON.parse((function(){try{return localStorage.getItem('mx_agent_memory')||'{}';}catch(e){return '{}';}})());
const learnedDirs = JSON.parse((function(){try{return localStorage.getItem('mx_learned')||'{}';}catch(e){return '{}';}})());
function mgrKey(){ return (currentManager && currentManager.username) || 'guest'; }
function saveMemory(){ try{ localStorage.setItem('mx_agent_memory', JSON.stringify(agentMemory)); }catch(e){} }
function saveLearned(){ try{ localStorage.setItem('mx_learned', JSON.stringify(learnedDirs)); }catch(e){} }
function learnedFor(n){ const mk=mgrKey(); return ((learnedDirs[mk]||{})[n]||[]); }
function learnDirective(n,text){
  const t=(text||'').trim();
  if(!t)return;
  if(!/^(always|never|remember|from now on|going forward|teach|note|don't|do not|make sure|prioriti[sz]e)/i.test(t))return;
  const mk=mgrKey();
  const list=(learnedDirs[mk]=learnedDirs[mk]||{})[n]=((learnedDirs[mk]||{})[n]||[]);
  list.push(t);
  if(list.length>20)list.splice(0,list.length-20);
  saveLearned();
}
function clearAgentMemory(n){ const mk=mgrKey(); if(n){ delete (agentMemory[mk]||{})[n]; delete (learnedDirs[mk]||{})[n]; } else { delete agentMemory[mk]; delete learnedDirs[mk]; } saveMemory(); saveLearned(); }
function memFor(n){ const mk=mgrKey(); return (((agentMemory[mk]||{})[n])||[]).slice(-12); }
function pushMemory(n,u,r){if(!n)return;const mk=mgrKey();const mm=agentMemory[mk]=agentMemory[mk]||{};const m=mm[n]=mm[n]||[];m.push({role:'user',content:u},{role:'assistant',content:r});if(m.length>24)mm[n]=m.slice(-24);learnDirective(n,u);saveMemory();}
function agentSys(n,s){
  const p=AGENT_PERSONAS[n];
  const learned=learnedFor(n);
  let base=s;
  if(learned.length){ base=s+'\n\n--- WHAT YOUR MANAGER HAS TAUGHT YOU ---\n'+learned.map(function(d,i){return (i+1)+'. '+d;}).join('\n')+'\n--- END TAUGHT ---'; }
  return p ? (p+'\n\nCURRENT TASK:\n'+base) : base;
}
