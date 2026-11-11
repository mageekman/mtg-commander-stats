// Every read is owner-scoped and fully paginated; a snapshot never truncates at
// the Data API's per-response limit. Only the selected period's games are read.
async function pages(client,table,fields,owner,range,signal){
 const rows=[];
 for(let offset=0;;offset+=1000){let q=client.from(table).select(fields).eq('owner_id',owner);if(table==='personal_games'){if(range.range_start)q=q.gte('played_at',range.range_start);if(range.range_end)q=q.lte('played_at',range.range_end)}q=q.order('id').range(offset,offset+999);if(signal)q=q.abortSignal(signal);const {data,error}=await q;if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)return rows}
}
export async function loadShareLedger(client,user,range,signal){
 if(!user?.id)throw Error('Sign in to share your Ledger.');
 const [decks,games,profile,art]=await Promise.all([
  pages(client,'decks','id,name,commander,archived_at',user.id,range,signal),
  pages(client,'personal_games','id,deck_id,played_at,won,players,winner_player',user.id,range,signal),
  client.from('profiles').select('display_name,handle,favorite_commander,passport_art,ledger_settings').eq('id',user.id).maybeSingle(),
  client.from('ledger_art_adjustments').select('slot,commander,x,y,zoom').eq('owner_id',user.id)
 ]);
 if(profile.error)throw profile.error;
 if(!profile.data)throw Error('Your Ledger settings could not be loaded.');
 return {decks,games,profile:profile.data||{},art:art.error?[]:art.data||[]};
}
