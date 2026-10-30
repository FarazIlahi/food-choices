export function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function shiftDate(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return dateKey(d);}
export function weekDates(key){const d=new Date(key+'T12:00:00');return Array.from({length:7},(_,i)=>shiftDate(key,i-((d.getDay()+6)%7)));}
export function tally(meals,votes){return meals.map(m=>({...m,voters:votes.filter(v=>v.meal_id===m.id)})).sort((a,b)=>b.voters.length-a.voters.length);}
export function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
