import {createClient} from './vendor/supabase-js.mjs';
import {readPageUser,showAuthPrompt} from './auth-page-state.js?v=deck-share-3';
import {mountShareDeck} from './share-deck.js?v=1';
const client=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const root=document.getElementById('shareDeckContent'),{user,error}=await readPageUser(client);if(!user)showAuthPrompt(root,{message:'Sign in to share your deck.',error});else{const id=new URLSearchParams(location.search).get('id');if(!/^[0-9a-f-]{36}$/i.test(id||''))root.textContent='Choose a deck to share from its profile.';else await mountShareDeck(root,{client,user,id})}
