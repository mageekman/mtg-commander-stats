// Keep server ranking and client display aligned with supabase-opponent-names.sql.
export const genericOpponentPatterns={
 "empty": "^(n a|na|none|tbd|not specified|not provided|no name|you|yourself|self|me|myself|null|undefined|missing|not recorded|not entered|not set|name not provided|name unknown|no opponent recorded)?$",
 "role": "(^| )(opponents?|opps?|players?|enem(?:y|ies)|rivals?|guests?|strangers?|persons?|participants?|competitors?|challengers?|users?|someone|somebody|humans?|bots?|cpu|computer|ai|seats?|slots?|tables?|pods?|hosts?|winners?|losers?|friends?|foes?|teammates?|unknown|unnamed|anonymous|anon|default|generic|unidentified|unrecorded|placeholder)( |$)",
 "tokens": "^(opponents?|opps?|players?|enem(?:y|ies)|rivals?|guests?|strangers?|persons?|participants?|competitors?|challengers?|users?|someone|somebody|humans?|bots?|cpu|computer|ai|seats?|slots?|tables?|pods?|hosts?|winners?|losers?|friends?|foes?|teammates?|unknown|unnamed|anonymous|anon|default|generic|unidentified|unrecorded|placeholder|the|a|an|another|random|other|imported|import|from|csv|name|no|number|you|self|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|i|ii|iii|iv|v|vi|vii|viii|ix|x|[0-9]+|[a-z])( (opponents?|opps?|players?|enem(?:y|ies)|rivals?|guests?|strangers?|persons?|participants?|competitors?|challengers?|users?|someone|somebody|humans?|bots?|cpu|computer|ai|seats?|slots?|tables?|pods?|hosts?|winners?|losers?|friends?|foes?|teammates?|unknown|unnamed|anonymous|anon|default|generic|unidentified|unrecorded|placeholder|the|a|an|another|random|other|imported|import|from|csv|name|no|number|you|self|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|i|ii|iii|iv|v|vi|vii|viii|ix|x|[0-9]+|[a-z]))*$"
};
const emptyPattern=new RegExp(genericOpponentPatterns.empty);
const rolePattern=new RegExp(genericOpponentPatterns.role);
const tokensPattern=new RegExp(genericOpponentPatterns.tokens);
export function isGenericOpponentName(value){
 const name=String(value??'').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase()
  .replace(/([a-z])([0-9])/g,'$1 $2').replace(/([0-9])([a-z])/g,'$1 $2')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 return emptyPattern.test(name)||(rolePattern.test(name)&&tokensPattern.test(name));
}

