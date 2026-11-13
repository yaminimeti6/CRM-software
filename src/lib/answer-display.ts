// Display grouping only: unknown dynamic fields remain customer answers.
const metadata=new Set(['utmsource','utmmedium','utmcampaign','utmcontent','utmterm','utmid','place','campid','adcrevid','adcrevname','campaignid','campaignname','adsetid','adsetname','adid','adname','creativeid','creativename','adaccountid','pageurl','landingpage','landingpageurl','website','referrer','fbclid','gclid','wbraid','gbraid','course','coursename','courseid','courseprice','price','orderid','submissionid','formid','formversion','trafficsource']);
export function splitAnswers(values:Record<string,unknown>={}){
 const customer:Record<string,unknown>=Object.create(null),details:Record<string,unknown>=Object.create(null);
 for(const[key,value]of Object.entries(values)){
  const normalized=key.toLowerCase().replace(/[^a-z0-9]/g,'');
  (metadata.has(normalized)?details:customer)[key]=value;
 }
 return {customer,details};
}
