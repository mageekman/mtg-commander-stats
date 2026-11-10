export function setupDeckRemoval({sb,deckId,ownerId,onComplete}){
 const open=document.getElementById('deleteDeck'),dialog=document.getElementById('deleteDeckDialog'),status=document.getElementById('deleteDeckStatus');
 const remove=document.getElementById('confirmDeleteDeck'),archive=document.getElementById('archiveDeckInstead'),cancel=document.getElementById('cancelDeleteDeck'),save=document.getElementById('saveImported');
 let busy=false;
 open.hidden=false;
 open.onclick=()=>{status.textContent='';dialog.showModal()};
 cancel.onclick=()=>dialog.close();
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault()});
 async function act(deleting){
  if(busy)return;
  busy=true;for(const button of [remove,archive,cancel,save,open])button.disabled=true;
  status.textContent=deleting?'Deleting deck and its games…':'Archiving deck…';
  try{
   const query=deleting?sb.from('decks').delete():sb.from('decks').update({archived_at:new Date().toISOString()});
   const {data,error}=await query.eq('id',deckId).eq('owner_id',ownerId).select('id').single();
   if(error)throw error;
   if(!data)throw Error('Deck not found or you no longer have permission to change it.');
   onComplete();
  }catch(error){status.textContent=(deleting?'Could not delete deck: ':'Could not archive deck: ')+error.message}
  finally{busy=false;for(const button of [remove,archive,cancel,save,open])button.disabled=false}
 }
 remove.onclick=()=>act(true);
 archive.onclick=()=>act(false);
}
