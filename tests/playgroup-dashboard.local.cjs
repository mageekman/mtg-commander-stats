const fs=require('fs'),assert=require('assert/strict');
(async()=>{const{PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema private;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,private to authenticated;create table public.profiles(id uuid primary key,handle text,display_name text);create table private.playgroup_members(group_id uuid,user_id uuid,primary key(group_id,user_id));create table private.playgroup_games(group_id uuid,event_id uuid,played_at date,snapshot jsonb,primary key(group_id,event_id));create table public.personal_games(id uuid,owner_id uuid,played_at date,players jsonb);`);
 const ids=Array.from({length:5},(_,i)=>'11111111-1111-4111-8111-'+String(i+1).padStart(12,'0')),group='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 for(let i=0;i<5;i++)await db.query('insert into public.profiles values($1,$2,$3)',[ids[i],'user'+i,'Player '+i]);for(let i=0;i<3;i++)await db.query('insert into private.playgroup_members values($1,$2)',[group,ids[i]]);await db.query('insert into private.playgroup_members values($1,$2)',[other,ids[3]]);
 let event=0;const seat=(i,commander)=>({participant_id:ids[i],name:'Old saved name',commander});
 async function game(players,winner,date='2026-11-19',g=group){event++;await db.query('insert into private.playgroup_games values($1,$2,$3,$4)',[g,'22222222-2222-4222-8222-'+String(event).padStart(12,'0'),date,{players,winner_player:winner}])}
 // Same commander in two seats: two appearances, one win, no event duplication.
 await game([seat(0,'Atraxa'),seat(1,'Atraxa')],0);
 await game([seat(0,'Atraxa'),seat(1,'Ur-Dragon')],1);
 await game([seat(0,'Atraxa'),seat(1,'Ur-Dragon')],0);
 await game([seat(0,'Atraxa'),{name:'Player 1',commander:'Krenko'}],1);
 await game([seat(1,'Ur-Dragon'),{name:'Guest',commander:''}],0,'2026-01-01');
 await game([seat(2,'Krenko'),seat(3,'Niv-Mizzet')],0); // Former/nonmember seat still counts for commander performance.
 await game([seat(2,'Krenko'),{name:'Guest',commander:'Niv-Mizzet'}],1);
 await game([seat(3,'Secret Commander'),seat(4,'Secret Commander')],0,'2026-11-19',other);
 await db.query('insert into public.personal_games values(gen_random_uuid(),$1,$2,$3)',[ids[0],'2026-11-19',[seat(0,'PRIVATE COMMANDER')]]);
 const file=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_playgroup_dashboard.sql'));await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 async function as(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}
 async function stats(g=group,start=null,end=null){return(await db.query('select public.get_playgroup_stats($1,$2,$3) value',[g,start,end])).rows[0].value}
 await as(ids[0]);let data=await stats();assert.equal(data.games,7);assert.equal(data.players_ranked,3);assert.equal(data.commanders_played,4);assert.ok(!JSON.stringify(data).includes('PRIVATE'));assert.ok(!JSON.stringify(data).includes('Secret'));
 const a=data.rankings.find(r=>r.id===ids[0]),b=data.rankings.find(r=>r.id===ids[1]),c=data.rankings.find(r=>r.id===ids[2]);assert.deepEqual([a.games,a.wins,a.win_rate],[4,2,50]);assert.deepEqual([b.games,b.wins,b.win_rate],[4,2,50]);assert.deepEqual([c.games,c.wins,c.win_rate],[2,1,50]);assert.equal(a.win_rank,1);assert.equal(b.win_rank,2);assert.equal(c.win_rank,3,'win-rate tie uses games played');assert.equal(a.games_rank,1);
 const atraxa=data.commanders.find(c=>c.commander==='Atraxa');assert.deepEqual([atraxa.appearances,atraxa.wins,atraxa.win_rate],[5,2,40]);
 data=await stats(group,'2026-11-19','2026-11-19');assert.equal(data.games,6);assert.equal(data.rankings.find(r=>r.id===ids[1]).games,3);assert.equal(data.rankings.find(r=>r.id===ids[1]).win_rate,33.3,'guest with same name is never attached to member');
 data=await stats(group,'2027-01-01','2027-01-31');assert.deepEqual([data.games,data.players_ranked,data.commanders_played],[0,0,0]);assert.deepEqual(data.rankings,[]);assert.deepEqual(data.commanders,[]);await assert.rejects(stats(group,'2026-12-01','2026-01-01'),/Start date/);
 await assert.rejects(stats(other),/Only members/);await as(ids[3]);await assert.rejects(stats(),/Only members/);await as(null);await assert.rejects(stats(),/Only members/);await as(null,'anon');await assert.rejects(stats(),/permission denied/);
 await as(ids[0]);await db.exec('reset role');await db.query('delete from private.playgroup_members where user_id=$1',[ids[1]]);await as(ids[0]);data=await stats();assert.equal(data.players_ranked,2);assert.equal(data.games,7,'membership changes never delete history');assert.equal(data.commanders.find(c=>c.commander==='Atraxa').appearances,5);
 // Defensive count: a duplicated participant ID contributes one game/win, not extra ranking weight.
 await db.exec('reset role');await game([seat(0,'Krenko'),seat(0,'krenko')],0);await as(ids[0]);data=await stats();assert.equal(data.rankings.find(r=>r.id===ids[0]).games,5);assert.equal(data.commanders.filter(c=>c.commander.toLowerCase()==='krenko').length,1);
 await db.exec('reset role');const acl=(await db.query("select prosecdef,has_function_privilege('anon',oid,'execute') as anon from pg_proc where oid='public.get_playgroup_stats(uuid,date,date)'::regprocedure")).rows[0];assert.deepEqual(acl,{prosecdef:false,anon:false});
 console.log('PASS shared-only aggregates, event counts, member identity/current membership, guest wins, mirrored commanders, case folding, exact ranking ties, dates/empty/invalid ranges, independent groups, anonymous and invitee denial, and invoker RPC permissions');
 }finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
