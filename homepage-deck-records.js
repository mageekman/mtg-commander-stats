// Compact all-time totals, independently paginated from the four recent game cards.
export async function loadHomepageDeckRecords(client){
 const records=new Map();
 for(let offset=0;;offset+=1000){
  const {data,error}=await client.rpc('get_my_deck_records').order('deck_id').range(offset,offset+999);
  if(error)throw error;if(!Array.isArray(data))throw Error('Deck totals are unavailable.');
  for(const row of data||[])records.set(row.deck_id,{games:Number(row.games),wins:Number(row.wins),last:row.last_played||null});
  if(!data||data.length<1000)return records;
 }
}
