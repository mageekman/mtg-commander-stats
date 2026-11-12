import {node} from './deck-visuals.js?v=reports-2';
const given=value=>value!==null&&value!==undefined&&String(value).trim()!=='';
export function addCommanderCaption(box,name){
 if(!given(name))return box;
 const caption=node('span',name);caption.className='deck-art-caption';box.append(caption);return box;
}
// The owner page and review preview use the same hero and optional-field rules.
export function createDeckHero(deck,{commanders=[],colors=null,cardCount=0}={}){
 const hero=node('section');hero.className='hero deck-hero-with-record';
 const artwork=node('div');artwork.className='deck-hero-art';
 for(const {name,url}of commanders){if(!url)continue;const frame=node('figure');frame.className='deck-commander-frame';const image=node('img');image.src=url;image.alt=name||'';frame.append(image);addCommanderCaption(frame,name);artwork.append(frame)}
 if(artwork.children.length)hero.append(artwork);
 const details=node('div');details.className='deck-hero-details';if(given(deck.name))details.append(node('h2',deck.name));
 const fields=node('dl');fields.className='deck-detail-fields';
 const field=(label,value)=>{if(!given(value))return;const row=node('div');row.append(node('dt',label),node('dd',value));fields.append(row)};
 if(Array.isArray(colors)){
  const row=node('div'),value=node('dd');value.className='deck-color-identity';row.append(node('dt','Color combo'),value);const names={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};const ordered=[...'WUBRG'].filter(color=>colors.includes(color));
  if(!ordered.length)value.append(node('span','Colorless'));else for(const color of ordered){const image=node('img');image.src='./assets/mana/'+color+'.svg?v=1';image.alt=names[color];image.title=names[color];image.width=image.height=24;value.append(image)}fields.append(row);
 }
 field('Bracket',deck.bracket_level);field('Theme',deck.theme);if(cardCount>0)field('Deck list',cardCount+' cards');if(deck.archived_at)field('Status','Archived');
 if(!artwork.children.length)field('Commander',deck.commander);
 if(fields.children.length)details.append(fields);
 if(given(deck.decklist_url)){try{const url=new URL(deck.decklist_url);if(['http:','https:'].includes(url.protocol)){const link=node('a','View external decklist');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';details.append(link)}}catch{}}
 if(given(deck.notes)){const notes=node('div');notes.className='deck-hero-notes';notes.append(node('h3','Deck notes'),node('p',deck.notes));details.append(notes)}
 hero.append(details);const summary=node('aside');summary.className='deck-hero-performance';summary.setAttribute('aria-label','Deck record');summary.setAttribute('aria-live','polite');summary.append(node('p','Loading deck record…'));hero.append(summary);
 return {hero,summary};
}
