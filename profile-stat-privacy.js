export const privacyGroups=[
 ['Record and performance',[
  ['share_record','Games played'],['share_win_chart','Win rate, wins, and losses'],['share_win_trend','Win-rate trend'],
  ['share_best_deck','Best deck'],['share_most_played_deck','Most played deck'],
  ['share_most_played_color','Most played color'],['share_best_color_combo','Strongest Color']]],
 ['Rivalry Summary',[
  ['share_lost_to_commander','Rival Commander'],['share_lost_to_player','Rival Player'],['share_lost_to_color','Rival Color Combo']]],
 ['Play Patterns',[
  ['share_first_player','Going First Advantage'],['share_deck_rotation','Deck Rotation (active deck usage and last played)']]],
 ['Friends',[
  ['share_games_together','Games Together (friend display names, commanders, and your results)'],['share_friend_results','Your Results with friends (combined games, wins, and losses)']]],
 ['Decks', [['share_deck_stats','By Deck carousel (active decks with games)']]]
];
export const privacyKeys=['public_full_stats',...privacyGroups.flatMap(([,fields])=>fields.map(([key])=>key))];
export function mountPrivacyChoices(host){
 for(const [title,fields]of privacyGroups){const group=document.createElement('fieldset');group.className='profile-privacy-group';const legend=document.createElement('legend');legend.textContent=title;group.append(legend);for(const [key,text]of fields){const label=document.createElement('label');label.className='privacy-option';const input=document.createElement('input');input.type='checkbox';input.name=key;label.append(input,document.createTextNode(' '+text));group.append(label)}host.append(group)}
 const form=host.closest('form'),all=form.elements.public_full_stats;all.onchange=()=>{for(const input of host.querySelectorAll('input'))input.checked=all.checked};host.addEventListener('change',()=>{all.checked=[...host.querySelectorAll('input')].every(input=>input.checked)});
}
