export function confirmGameDeletion(){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='game-delete-dialog';
  dialog.setAttribute('aria-labelledby','gameDeleteTitle');dialog.setAttribute('aria-describedby','gameDeleteWarning');
  dialog.innerHTML='<h2 id="gameDeleteTitle">Are you sure?</h2><p id="gameDeleteWarning">This action is permanent and the game cannot be restored.</p><div class="game-delete-dialog-actions"><button type="button" class="confirm-game-delete">Delete</button><button type="button" class="cancel-game-delete" autofocus>Cancel</button></div>';
  document.body.append(dialog);
  let confirmed=false;
  dialog.querySelector('.confirm-game-delete').onclick=()=>{confirmed=true;dialog.close()};
  dialog.querySelector('.cancel-game-delete').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{dialog.remove();resolve(confirmed)},{once:true});
  dialog.showModal();
 });
}
