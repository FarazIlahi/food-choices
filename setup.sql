-- Food Choices: paste this entire file into a new Supabase project's SQL Editor.
-- Tables are private. Only the narrowly scoped RPC functions below are exposed.
begin;
create schema if not exists food_private;
revoke all on schema food_private from public, anon, authenticated;

create table if not exists food_private.rooms (
 id uuid primary key default gen_random_uuid(),
 code_hash bytea not null unique,
 timezone text not null default 'America/New_York'
);
create table if not exists food_private.members (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references food_private.rooms(id),
 token uuid not null unique default gen_random_uuid(),
 name text not null check(length(name) between 1 and 30)
);
create unique index if not exists fc_member_names on food_private.members(room_id,lower(name));
create table if not exists food_private.meals (
 id uuid not null default gen_random_uuid(),
 room_id uuid not null references food_private.rooms(id),
 day date not null,
 name text not null check(length(name) between 1 and 80),
 emoji text not null check(length(emoji) between 1 and 12),
 category text not null check(category in ('Comfort food','Quick & easy','Vegetarian','Fresh & light')),
 time integer check(time between 1 and 480),
 primary key(room_id,day,id)
);
create unique index if not exists fc_unique_meals on food_private.meals(room_id,day,lower(name));
create table if not exists food_private.votes (
 room_id uuid not null references food_private.rooms(id),
 day date not null,
 member_id uuid not null references food_private.members(id),
 meal_id uuid not null,
 primary key(room_id,day,member_id),
 foreign key(room_id,day,meal_id) references food_private.meals(room_id,day,id)
);
alter table food_private.rooms enable row level security;
alter table food_private.members enable row level security;
alter table food_private.meals enable row level security;
alter table food_private.votes enable row level security;
revoke all on all tables in schema food_private from public,anon,authenticated;

create or replace function food_private.room(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
 if p_code is null or p_code !~ '^[A-Za-z0-9-]{12,80}$' then raise exception 'Invalid family invite code.'; end if;
 select id into rid from food_private.rooms where code_hash=pg_catalog.sha256(pg_catalog.convert_to(p_code,'UTF8'));
 if rid is null then raise exception 'Family not found. Check your invite code.'; end if;
 return rid;
end;$$;

create or replace function food_private.member(p_room uuid,p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare mid uuid;
begin
 select id into mid from food_private.members where room_id=p_room and token=p_token;
 if mid is null then raise exception 'Please join the family on this device first.'; end if;
 return mid;
end;$$;

create or replace function food_private.check_day(p_room uuid,p_day date,p_write boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare today date;
begin
 select (pg_catalog.now() at time zone timezone)::date into today from food_private.rooms where id=p_room;
 if p_day is null or p_day<today-365 or p_day>today+365 then raise exception 'Choose a day within one year of today.'; end if;
 if p_write and p_day<today then raise exception 'Voting is closed for past days.'; end if;
end;$$;

create or replace function public.fc_health() returns text
language sql security definer set search_path = '' as $$select 'food-choices-ready'::text;$$;

create or replace function public.fc_enter(p_code text,p_name text,p_create boolean default false,p_timezone text default 'America/New_York') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare rid uuid; mid uuid; secret uuid; clean text:=pg_catalog.btrim(p_name);
begin
 if p_code is null or p_code !~ '^[A-Za-z0-9-]{12,80}$' then raise exception 'Use the full family invite code (at least 12 characters).'; end if;
 if clean is null or length(clean)<1 or length(clean)>30 then raise exception 'Use a name between 1 and 30 characters.'; end if;
 if p_create then
   if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid family timezone.'; end if;
   insert into food_private.rooms(code_hash,timezone) values(pg_catalog.sha256(pg_catalog.convert_to(p_code,'UTF8')),p_timezone) returning id into rid;
 else rid:=food_private.room(p_code);
 end if;
 insert into food_private.members(room_id,name) values(rid,clean) returning id,token into mid,secret;
 return pg_catalog.jsonb_build_object('member_id',mid,'token',secret);
exception when unique_violation then raise exception 'That name or invite code is already in use. Try a different one.';
end;$$;

create or replace function public.fc_ballot(p_code text,p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare rid uuid:=food_private.room(p_code); meal_data jsonb; vote_data jsonb; offset_day integer;
begin
 perform food_private.check_day(rid,p_day,false);
 -- Serialize first-time seeding and suggestions so every phone sees the same choices.
 perform 1 from food_private.rooms where id=rid for update;
 if not exists(select 1 from food_private.meals where room_id=rid and day=p_day) then
   offset_day:=((p_day-date '2020-01-01')%8+8)%8;
   insert into food_private.meals(room_id,day,name,emoji,category,time)
   select rid,p_day,x.name,x.emoji,x.category,x.mins from (values
    (0,'Chicken shawarma bowls','🥙','Comfort food',30),
    (1,'Creamy tomato pasta','🍝','Vegetarian',25),
    (2,'Build-your-own tacos','🌮','Quick & easy',20),
    (3,'Salmon & roasted veggies','🐟','Fresh & light',30),
    (4,'Homemade pizza night','🍕','Comfort food',40),
    (5,'Chickpea coconut curry','🍛','Vegetarian',30),
    (6,'Garlic chicken stir-fry','🥡','Quick & easy',20),
    (7,'Chicken biryani','🍚','Comfort food',50)
   ) as x(n,name,emoji,category,mins) where ((x.n-offset_day+8)%8)<3;
 end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'name',name,'emoji',emoji,'category',category,'time',time) order by name),'[]'::jsonb)
 into meal_data from food_private.meals where room_id=rid and day=p_day;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('member_id',v.member_id,'meal_id',v.meal_id,'name',m.name) order by m.name),'[]'::jsonb)
 into vote_data from food_private.votes v join food_private.members m on m.id=v.member_id where v.room_id=rid and v.day=p_day;
 return pg_catalog.jsonb_build_object('meals',meal_data,'votes',vote_data);
end;$$;

create or replace function public.fc_suggest(p_code text,p_token uuid,p_day date,p_name text,p_category text,p_time integer,p_emoji text) returns void
language plpgsql security definer set search_path = '' as $$
declare rid uuid:=food_private.room(p_code);
begin
 perform food_private.member(rid,p_token);
 perform food_private.check_day(rid,p_day,true);
 perform 1 from food_private.rooms where id=rid for update;
 if (select count(*) from food_private.meals where room_id=rid and day=p_day)>=15 then raise exception 'The shortlist is full (15 meals).'; end if;
 insert into food_private.meals(room_id,day,name,emoji,category,time) values(rid,p_day,pg_catalog.btrim(p_name),p_emoji,p_category,p_time);
exception when unique_violation then raise exception 'That meal is already on the table.';
end;$$;

create or replace function public.fc_vote(p_code text,p_token uuid,p_day date,p_meal uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare rid uuid:=food_private.room(p_code); mid uuid:=food_private.member(rid,p_token);
begin
 perform food_private.check_day(rid,p_day,true);
 if p_meal is null then delete from food_private.votes where room_id=rid and day=p_day and member_id=mid;
 else
 insert into food_private.votes(room_id,day,member_id,meal_id) values(rid,p_day,mid,p_meal)
 on conflict(room_id,day,member_id) do update set meal_id=excluded.meal_id;
 end if;
end;$$;

revoke all on all functions in schema food_private from public,anon,authenticated;
revoke all on function public.fc_health() from public;
revoke all on function public.fc_enter(text,text,boolean,text) from public;
revoke all on function public.fc_ballot(text,date) from public;
revoke all on function public.fc_suggest(text,uuid,date,text,text,integer,text) from public;
revoke all on function public.fc_vote(text,uuid,date,uuid) from public;
grant execute on function public.fc_health() to anon,authenticated;
grant execute on function public.fc_enter(text,text,boolean,text) to anon,authenticated;
grant execute on function public.fc_ballot(text,date) to anon,authenticated;
grant execute on function public.fc_suggest(text,uuid,date,text,text,integer,text) to anon,authenticated;
grant execute on function public.fc_vote(text,uuid,date,uuid) to anon,authenticated;
commit;
