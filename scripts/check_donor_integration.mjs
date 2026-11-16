import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {DEST} from '../public/destinations.js';
globalThis.fetch=async input=>new Response(await readFile(fileURLToPath(input?.url||String(input))));
const result=JSON.parse(await readFile('verification/donor-navigation-baseline.json','utf8'));
const {loadPartnerScene}=await import('../public/partner-scene.js');
globalThis.ProgressEvent=class {constructor(type,props){Object.assign(this,{type},props);}};
const integrated=await loadPartnerScene({deferShade:true});
const actual={paths:integrated.rows.length,nodes:integrated.network.nodes.length,edges:integrated.network.edges.filter(e=>!e.inactive).length};
for(const field of ['paths','nodes','edges'])if(actual[field]!==result[field])throw Error('Donor integration mismatch: '+field);
let samples=0,maxHeightError=0;for(const row of integrated.rows)for(const c of row.c){const source=integrated.atSource(...c),expected=integrated.landscape.tourHeight(source.x,source.z)*2.5;maxHeightError=Math.max(maxHeightError,Math.abs(expected-integrated.height(...c)));samples++;}
const main=integrated.network.mainComponent;for(const [key,d]of Object.entries(DEST))if(!d.island&&integrated.network.nodes.find(n=>n.id===integrated.navigationTargets[key]?.nodeId)?.component!==main)throw Error('Mainland destination disconnected: '+key);
const provenance={passed:true,actual,reference:{paths:result.paths,nodes:result.nodes,edges:result.edges},allSourcePathPoints:samples,maxHeightErrorSceneUnits:maxHeightError,landmarkErrors:integrated.errors,restoredDonorNavigation:true,limits:['Preserving donor navigation is not a full physical collider or GPU visual acceptance.']};
if(integrated.errors.length||maxHeightError>1e-6)throw Error('Model/height integration failed '+JSON.stringify(provenance));
await writeFile('verification/donor-integration.json',JSON.stringify(provenance,null,2));console.log(JSON.stringify(provenance));
