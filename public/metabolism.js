// Mifflin et al., Am J Clin Nutr 1990;51:241–247. PMID 2305711.
// Estimates resting energy expenditure, not measured basal metabolism or heat risk.
export function estimateMetabolism(input){
 const fields=['heightCm','weightKg','age'];
 if(!input||fields.some(k=>input[k]==null||input[k]===''||!Number.isFinite(Number(input[k]))))return {status:'incomplete'};
 const heightCm=Number(input.heightCm),weightKg=Number(input.weightKg),age=Number(input.age),sex=input.sex||'unspecified';
 if(heightCm<80||heightCm>250||weightKg<20||weightKg>350||age<1||age>120||!Number.isInteger(age)||!['male','female','unspecified'].includes(sex))return {status:'invalid'};
 if(age<19||age>78)return {status:'outside_reference_age',referenceAge:[19,78]};
 const base=10*weightKg+6.25*heightCm-5*age;
 const kcal=sex==='male'?[base+5,base+5]:sex==='female'?[base-161,base-161]:[base-161,base+5];
 if(kcal[0]<=0)return {status:'invalid'};
 return {status:'ok',method:'Mifflin–St Jeor (1990)',kcalPerDay:kcal,watts:kcal.map(v=>v*4184/86400),range:sex==='unspecified',source:'https://pubmed.ncbi.nlm.nih.gov/2305711/'};
}
