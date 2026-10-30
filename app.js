import {dateKey,shiftDate,weekDates,escapeHTML as esc} from './core.js?v=4';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let config=window.FOOD_CONFIG?.url?window.FOOD_CONFIG:read('fc-config',{});
let family=read('fc-family',null),selected=dateKey(),ballot={meals:[],votes:[]},sequence=0,busy=false;
let demo=read('fc-demo',{}),demoName=read('fc-demo-name','');
const inviteCode=new URLSearchParams(location.hash.slice(1)).get('family');
const connected=()=>Boolean(config.url&&config.key&&family);
const dialog=$('#dialog');let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000)}
function modal(html){$('#dialog-content').innerHTML=html;dialog.showModal()}
$('#close-dialog').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
async function rpc(name,args){const r=await fetch(`${config.url.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error(data.message||'Could not connect. Please try again.');return data}
function demoBallot(day){if(!demo[day]){demo[day]={meals:[],votes:[]};save('fc-demo',demo)}return structuredClone(demo[day])}
async function getBallot(day){return connected()?rpc('fc_ballot',{p_code:family.code,p_day:day}):demoBallot(day)}
function header(){const on=connected();$('#connection').textContent=on?'Family connected':'Preview';$('#connection').classList.toggle('live',on);$('#family-button').textContent=on?`${family.name} · Family`:'Connect family';$('#demo-note').hidden=on}
function renderDays(){
 $('#date-label').textContent=new Date(selected+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
 $('#today-date').textContent='Today';
 $('#day-strip').innerHTML=weekDates(selected).map(d=>`<button class="day ${d===selected?'selected':''}" data-date="${d}" aria-pressed="${d===selected}"><span>${new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}</span><strong>${Number(d.slice(-2))}</strong></button>`).join('');
 $$('[data-date]').forEach(b=>b.onclick=()=>chooseDay(b.dataset.date));
}
function renderBallot(){
 const myId=connected()?family.member_id:'me',mine=ballot.votes.find(v=>v.member_id===myId),past=selected<dateKey();
 $('#add-meal').disabled=past||busy;$('#option-input').disabled=past||busy;
 $('#vote-summary').textContent=`${ballot.votes.length} ${ballot.votes.length===1?'vote':'votes'}${past?' · Voting closed':''}`;
 $('#meals').innerHTML=ballot.meals.map(m=>{
  const voters=ballot.votes.filter(v=>v.meal_id===m.id),chosen=mine?.meal_id===m.id;
  return `<article class="meal-card ${chosen?'chosen':''}"><div class="meal-info"><h2>${esc(m.name)}</h2><p class="voters">${voters.length?voters.map(v=>esc(v.name)+(v.member_id===myId?' (you)':'')).join(', '):'No votes yet'}</p></div><div class="meal-actions"><span class="vote-count" aria-label="${voters.length} votes">${voters.length}</span><button class="vote-button" data-vote="${esc(m.id)}" aria-label="${chosen?'Withdraw vote for':'Vote for'} ${esc(m.name)}" aria-pressed="${chosen}" ${past||busy?'disabled':''}>${chosen?'✓ Voted':'Vote'}</button></div></article>`;
 }).join('')||`<div class="empty"><span aria-hidden="true">🍽️</span><h2>No options yet</h2><p>${past?'No meals were added for this day.':'Add something you’d like to eat.'}</p></div>`;
 $$('[data-vote]').forEach(b=>b.onclick=()=>vote(b.dataset.vote));
}
async function load(quiet=false){
 const seq=++sequence;header();renderDays();
 if(!quiet)$('#meals').innerHTML='<p class="empty-message">Loading options…</p>';
 try{const b=await getBallot(selected);if(seq!==sequence)return;ballot=b;renderBallot()}
 catch(e){if(seq!==sequence)return;if(!quiet){$('#meals').innerHTML='<p class="empty-message">Couldn’t load options. <button class="text-button" id="retry">Try again</button></p>';$('#retry').onclick=()=>load()}toast(e.message)}
}
function chooseDay(day){selected=day;load()}
async function vote(id){
 if(busy||selected<dateKey())return;
 if(!connected()&&!demoName){
  modal(`<h2 class="dialog-title">Your name</h2><p class="dialog-intro">So everyone can see who voted.</p><form id="name-form"><label class="field">Name<input name="name" maxlength="30" required autocomplete="given-name" placeholder="e.g. Faraz"></label><button class="button primary">Save & vote</button></form>`);
  $('#name-form').onsubmit=e=>{e.preventDefault();demoName=new FormData(e.target).get('name').trim();if(!demoName)return;save('fc-demo-name',demoName);dialog.close();vote(id)};return;
 }
 const day=selected,myId=connected()?family.member_id:'me',remove=ballot.votes.some(v=>v.member_id===myId&&v.meal_id===id);
 busy=true;renderBallot();
 try{
  if(connected())await rpc('fc_vote',{p_code:family.code,p_token:family.token,p_day:day,p_meal:remove?null:id});
  else{demo[day].votes=demo[day].votes.filter(v=>v.member_id!=='me');if(!remove)demo[day].votes.push({member_id:'me',name:demoName,meal_id:id});save('fc-demo',demo)}
  await load(true);
 }catch(e){toast(e.message)}finally{busy=false;renderBallot()}
}
async function addOption(event){
 event.preventDefault();if(busy||selected<dateKey())return;
 const name=$('#option-input').value.trim(),day=selected;if(!name)return;
 busy=true;renderBallot();$('#option-error').textContent='';
 try{
  if(connected())await rpc('fc_suggest',{p_code:family.code,p_token:family.token,p_day:day,p_name:name,p_category:'Comfort food',p_time:null,p_emoji:'🍽️'});
  else{const b=demoBallot(day);if(b.meals.some(m=>m.name.toLowerCase()===name.toLowerCase()))throw Error('That option is already on the list.');if(b.meals.length>=15)throw Error('You can add up to 15 options per day.');demo[day].meals.push({id:crypto.randomUUID(),name});save('fc-demo',demo)}
  $('#option-input').value='';await load(true);toast('Option added.');
 }catch(e){$('#option-error').textContent=e.message}
 finally{busy=false;renderBallot();$('#option-input').focus()}
}

function familyDialog(){if(!config.url||!config.key){setupDialog();return}if(connected()){modal(`<div class="eyebrow">YOUR TABLE</div><h2 class="dialog-title">Hey, ${esc(family.name)}.</h2><p class="dialog-intro">Your votes are shared with everyone using your family’s invite link. Keep the link within your family.</p><div class="dialog-actions"><button class="button primary" id="copy-invite">Copy family invite ↗</button><button class="button outline" id="leave-family">Leave on this device</button></div><p class="hint" style="margin-top:18px">Leaving removes this device’s identity. Your existing votes remain. Use a new display name if you rejoin, or save this browser’s data to keep your identity.</p>`);$('#copy-invite').onclick=copyInvite;$('#leave-family').onclick=()=>{family=null;localStorage.removeItem('fc-family');history.replaceState(null,'',location.pathname);dialog.close();load()};return}
modal(`<div class="eyebrow">BETTER TOGETHER</div><h2 class="dialog-title">Pull up a chair.</h2><p class="dialog-intro">Start your family’s table, or join with an invite code.</p><form id="family-form"><label class="field">Your name<input name="name" maxlength="30" required placeholder="e.g. Faraz" autocomplete="given-name"></label><label class="field">Family invite code (to join)<input name="code" minlength="12" maxlength="80" placeholder="Leave blank to start a new family" value="${esc(inviteCode||'')}" autocomplete="off"></label><p class="hint">Your name identifies you on this phone. Each person should use their own phone and a different name.</p><p class="form-error" id="family-error" role="alert"></p><div class="dialog-actions"><button class="button primary" id="join-submit">Let’s eat together →</button><button type="button" class="text-button" id="edit-config">Connection settings</button></div></form>`);$('#edit-config').onclick=setupDialog;$('#family-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const name=f.get('name').trim();if(!name)return;const provided=f.get('code').trim();const code=provided||crypto.randomUUID().replaceAll('-','');$('#join-submit').disabled=true;try{const member=await rpc('fc_enter',{p_code:code,p_name:name,p_create:!provided,p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});family={...member,code,name};save('fc-family',family);history.replaceState(null,'',location.pathname);dialog.close();load();toast(provided?'Welcome to the family table!':'Your table is ready. Invite your family!')}catch(err){$('#family-error').textContent=err.message;$('#join-submit').disabled=false}}}
function setupDialog(){modal(`<div class="eyebrow">ONE-TIME FAMILY SETUP</div><h2 class="dialog-title">Connect your table.</h2><p class="dialog-intro">This site uses Supabase to share votes across phones. These are your project’s public connection details.</p><div class="setup-box">1. Create a free project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase ↗</a>.<br>2. Run <a href="./setup.sql" target="_blank">setup.sql</a> in its SQL Editor.<br>3. Paste your project URL and publishable key below.</div><form id="setup-form"><label class="field">Project URL<input type="url" name="url" required placeholder="https://your-project.supabase.co" value="${esc(config.url||'')}"></label><label class="field">Publishable key (or legacy anon key)<input name="key" required placeholder="sb_publishable_…" value="${esc(config.key||'')}" autocomplete="off"></label><p class="hint">Never paste a secret key or service-role key. For everyone to connect automatically, put these public details in config.js before publishing.</p><p id="setup-error" class="form-error" role="alert"></p><div class="dialog-actions"><button class="button primary" id="save-setup">Check & connect →</button></div></form>`);$('#setup-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),url=f.get('url').trim().replace(/\/$/,''),key=f.get('key').trim();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)){$('#setup-error').textContent='Use your HTTPS project URL from Supabase.';return}let role='';try{role=JSON.parse(atob(key.split('.')[1])).role}catch{}if(key.startsWith('sb_secret_')||role==='service_role'){$('#setup-error').textContent='Use a publishable or anon key, never a secret key.';return}const prev=config;config={url,key};$('#save-setup').disabled=true;try{await rpc('fc_health',{});save('fc-config',config);dialog.close();familyDialog()}catch(err){config=prev;$('#setup-error').textContent='Connection failed. Check the URL/key and run setup.sql first. '+err.message;$('#save-setup').disabled=false}};}
async function copyInvite(){if(!connected()){familyDialog();return}const url=new URL(location.href);url.hash=new URLSearchParams({family:family.code}).toString();try{await navigator.clipboard.writeText(url.href);toast('Invite link copied. Share it with your family.')}catch{modal(`<h2 class="dialog-title">Your family invite.</h2><p class="dialog-intro">Copy this private link and send it to your family.</p><label class="field">Invite link<input readonly value="${esc(url.href)}"></label>`);}}

$('#family-button').onclick=familyDialog;
$('#prev-day').onclick=()=>chooseDay(shiftDate(selected,-1));
$('#next-day').onclick=()=>chooseDay(shiftDate(selected,1));
$('#today-date').onclick=()=>chooseDay(dateKey());
$('#option-form').onsubmit=addOption;
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});
window.addEventListener('storage',e=>{if(e.key==='fc-demo'){demo=read('fc-demo',{});load(true)}});
setInterval(()=>{if(connected()&&!document.hidden&&!busy&&!dialog.open)load(true)},10000);
load();if(inviteCode&&!family)setTimeout(familyDialog,350);
