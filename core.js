export function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function shiftDate(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return dateKey(d);}
export function weekDates(key){const d=new Date(key+'T12:00:00');return Array.from({length:7},(_,i)=>shiftDate(key,i-((d.getDay()+6)%7)));}
export function tally(meals,votes){return meals.map(m=>({...m,voters:votes.filter(v=>v.meal_id===m.id)})).sort((a,b)=>b.voters.length-a.voters.length);}
export function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export const ideas=[
 {name:'Chicken shawarma bowls',emoji:'🥙',category:'Comfort food',time:30,tags:'chicken rice Mediterranean'},
 {name:'Creamy tomato pasta',emoji:'🍝',category:'Vegetarian',time:25,tags:'Italian pasta'},
 {name:'Build-your-own tacos',emoji:'🌮',category:'Quick & easy',time:20,tags:'Mexican beef chicken'},
 {name:'Salmon & roasted veggies',emoji:'🐟',category:'Fresh & light',time:30,tags:'fish healthy'},
 {name:'Homemade pizza night',emoji:'🍕',category:'Comfort food',time:40,tags:'Italian vegetarian'},
 {name:'Chickpea coconut curry',emoji:'🍛',category:'Vegetarian',time:30,tags:'Indian vegan rice'},
 {name:'Garlic chicken stir-fry',emoji:'🥡',category:'Quick & easy',time:20,tags:'Asian noodles'},
 {name:'Chicken biryani',emoji:'🍚',category:'Comfort food',time:50,tags:'Pakistani Indian rice'},
 {name:'Falafel & hummus wraps',emoji:'🧆',category:'Vegetarian',time:25,tags:'Mediterranean vegan'},
 {name:'Burgers & oven fries',emoji:'🍔',category:'Comfort food',time:35,tags:'beef American'},
 {name:'Lemon chicken salad',emoji:'🥗',category:'Fresh & light',time:20,tags:'healthy chicken'},
 {name:'Veggie fried rice',emoji:'🍳',category:'Quick & easy',time:15,tags:'Asian vegetarian'},
 {name:'Lentil soup & warm bread',emoji:'🍲',category:'Fresh & light',time:35,tags:'vegan soup'},
 {name:'Pesto mozzarella sandwiches',emoji:'🥪',category:'Quick & easy',time:15,tags:'vegetarian Italian'},
 {name:'Butter chicken & naan',emoji:'🫓',category:'Comfort food',time:40,tags:'Indian Pakistani curry'},
 {name:'Loaded baked potatoes',emoji:'🥔',category:'Vegetarian',time:45,tags:'cheese comfort'}
];
