// Newest first. Summarize shipped features, fixes, and stability improvements.
// Dates reflect publication; group related changes and omit minor layout tweaks.
export const changelogEntries=[
 {date:'2026-11-12',title:'Faster loading and more consistent stats',updates:[
  'Deck statistics load while card details are still being fetched, and smaller logo images help pages load faster.',
  'Homepage deck records include your full game history, including accounts with more than 1,000 games.',
  'The By Deck carousel on Ledgers and public profiles follows your minimum-games setting. Archived decks have matching layouts with grayscale artwork.',
  'Improved card-data request handling and recovery when the card service is busy.'
 ]},
 {date:'2026-11-12',title:'Interactive stats and Share My Deck',updates:[
  'Explore the games behind Ledger and deck statistics in searchable popups, with five games per page.',
  'Create Share My Deck snapshots with deck records, performance highlights, and commander artwork. Share images adapt to the information available.',
  'Deck display settings apply across your decks. New accounts start with all private Ledger and deck stats enabled.',
  'Fixed deck details not saving, improved deck-list validation when editing, and added clearer loading indicators.'
 ]},
 {date:'2026-11-11',title:'Share your Ledger and explore your colors',updates:[
  'Create Share My Ledger snapshots for a selected timeframe, with display settings that control which stats appear.',
  'Explore color-combination usage and Strongest Color, with minimum-game requirements and an opt-in public color chart.',
  'Adjust the win-rate graph timeline independently, or update it along with the rest of your Ledger.',
  'Improved commander artwork and mana symbols in share images, and brought public profile charts in line with the Ledger.'
 ]},
 {date:'2026-11-11',title:'Invites and connected game history',updates:[
  'Invite friends with a personal link that connects you when they join.',
  'Shared games retain tagged participants when friends add their own independent copy to their Ledger.',
  'Open player profiles and eligible friends’ decks directly from game history.',
  'Account creation now includes a username, favorite commander, password confirmation, and email-confirmation guidance.'
 ]},
 {date:'2026-11-10',title:'A richer Ledger and deck reports',updates:[
  'Updated the Ledger layout with grouped reports, rivalry summaries, and a By Deck carousel.',
  'Deck profiles now include visual performance, matchup, play-pattern, and activity reports.',
  'Create and edit games in a popup, choose your deck, and record opponents without requiring their names.',
  'Adjust commander artwork on passports, Ledger stats, and compact game history. Public profiles offer controls for which stats to share.'
 ]},
 {date:'2026-11-10',title:'Friends and rivalries',updates:[
  'Send and manage friend requests, with notifications for requests and accepted connections.',
  'Compare public win rates and games logged in friend rankings, and explore head-to-head rivalry summaries by timeframe.',
  'Tag friends and their decks when recording games, see recent games together, and invite tagged friends to add their own copy.',
  'Improved compact game history with editing and deletion controls, and clearer friend display names.'
 ]}
];
let dialog;
export function openChangelog(){
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='siteChangelog';dialog.setAttribute('aria-labelledby','siteChangelogTitle');
  const header=document.createElement('header'),title=document.createElement('h2');title.id='siteChangelogTitle';title.textContent='Changelog';
  const close=document.createElement('button');close.type='button';close.className='changelog-close';close.textContent='×';close.setAttribute('aria-label','Close changelog');close.onclick=()=>dialog.close();header.append(title,close);
  const body=document.createElement('div');body.className='changelog-body';
  const intro=document.createElement('p');intro.className='changelog-intro';intro.textContent='Features, fixes, and improvements to Command Ledger.';body.append(intro);
  for(const entry of changelogEntries){
   const article=document.createElement('article'),time=document.createElement('time');time.dateTime=entry.date;
   time.textContent=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(entry.date+'T12:00:00Z'));
   const heading=document.createElement('h3');heading.textContent=entry.title;const list=document.createElement('ul');
   for(const update of entry.updates){const item=document.createElement('li');item.textContent=update;list.append(item)}
   article.append(time,heading,list);body.append(article);
  }
  dialog.append(header,body);document.body.append(dialog);
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
 }
 if(!dialog.open){dialog.showModal();dialog.querySelector('.changelog-close').focus();dialog.querySelector('.changelog-body').scrollTop=0}
}
