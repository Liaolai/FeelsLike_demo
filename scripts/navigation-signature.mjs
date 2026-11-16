import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function navigationSignature(){
 const files=['public/partner-scene.js','public/ground-contact.js','public/road-seams.js','public/road-grading.js','public/road-grade-codec.js','public/road-paving.js','public/mesh-clearance.js','public/walk-surface.js','public/navigation-collision.js','public/navigation-rebuild.js','public/landmarks.js','public/destinations.js'];
 async function walk(dir){for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())await walk(file);else files.push(file);}}await walk('public/partner');
 const hash=createHash('sha256');for(const file of files.sort()){hash.update(file);const bytes=await readFile(path.join(root,file));hash.update(/\.(js|json|geojson)$/.test(file)?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes);}return hash.digest('hex');
}

