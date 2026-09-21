import {cp,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const source=dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));
const destination=resolve(dirname(fileURLToPath(import.meta.url)),'../public/document-viewer');
await mkdir(destination,{recursive:true});
for(const file of ['build/pdf.min.mjs','build/pdf.worker.min.mjs','cmaps','standard_fonts','wasm','LICENSE']){
 await cp(resolve(source,file),resolve(destination,file),{recursive:true});
}
