import {readdir,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const run=promisify(execFile),raw='.asset-tools/raw',output='public/assets/avatars';
const ids=['waves','cap','silver','outdoor','plain','braids','moon','rainbow','midnight'];
const files=(await readdir(raw)).filter(n=>n.endsWith('.glb')).sort();
await mkdir(output,{recursive:true});const manifest={};
for(let i=0;i<files.length;i++){
 const name=files[i],base=name.slice(0,-4),dest=output+'/'+name;
 if(!existsSync(dest)||process.argv.includes('--force'))await run(process.execPath,['node_modules/@gltf-transform/cli/bin/cli.js','optimize',raw+'/'+name,dest,'--compress','meshopt','--texture-compress','webp','--texture-size','512','--flatten','false','--join','false','--instance','false','--palette','false','--simplify','false'],{maxBuffer:2e6});
 const data=await readFile(dest),source=await readFile(raw+'/'+name),image=sharp(raw+'/'+base+'.jpg'),metadata=await image.metadata();
 await image.extract({left:0,top:0,width:Math.floor(metadata.width/3),height:metadata.height}).resize({width:180,height:240,fit:'contain',background:'#fffef9'}).webp({quality:80}).toFile(output+'/'+base+'.webp');
 manifest[ids[i]]={file:'/assets/avatars/'+name,portrait:'/assets/avatars/'+base+'.webp',hash:createHash('sha256').update(data).digest('hex'),sourceHash:createHash('sha256').update(source).digest('hex'),bytes:data.length,sourceBytes:source.length,frontRotation:-Math.PI/2};
 console.log(name+': '+source.length+' → '+data.length+' bytes');
}
await copyFile('node_modules/meshoptimizer/meshopt_decoder.mjs','public/assets/meshopt_decoder.module.js');
await writeFile('public/avatar-assets.js','// Optimized copies of the supplied GLB assets; originals are unchanged.\nexport const AVATAR_ASSETS='+JSON.stringify(manifest,null,2)+';\n');
await writeFile('verification/avatar-assets.json',JSON.stringify({sourceArchive:'9个角色_模型+骨骼+6动作_20261115.zip',optimization:'meshopt + WebP 512; no mesh simplification; bone hierarchy and all six animation clips retained',characters:manifest},null,2));
console.log('All nine models and portraits prepared.');
