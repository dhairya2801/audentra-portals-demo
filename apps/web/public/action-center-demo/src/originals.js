// Credentialed originals stay in memory; they are never written to browser preview storage.
import {boardRequest} from './identities.js';
import {store} from './store.js';
const files=new Map(),pdfs=new Map(),pages=new Map();
let pdfLibrary;
async function original(file){
 if(files.has(file.id))return files.get(file.id);
 const pending=boardRequest('demo-document',{path:file.contentPath}).then(blob=>{
  if(!(blob instanceof Blob))throw Error('Original unavailable');
  return {blob,url:URL.createObjectURL(blob)};
 }).catch(error=>{files.delete(file.id);throw error;});
 files.set(file.id,pending);return pending;
}
export function originalPageCount(id){return pages.get(id)||1;}
async function pdfDocument(file,blob){
 if(!pdfs.has(file.id))pdfs.set(file.id,(async()=>{
  pdfLibrary ||= import('/document-viewer/build/pdf.min.mjs');
  const lib=await pdfLibrary;lib.GlobalWorkerOptions.workerSrc='/document-viewer/build/pdf.worker.min.mjs';
  const pdf=await lib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),
   cMapUrl:'/document-viewer/cmaps/',cMapPacked:true,standardFontDataUrl:'/document-viewer/standard_fonts/',
   wasmUrl:'/document-viewer/wasm/',isEvalSupported:false}).promise;
  pages.set(file.id,pdf.numPages);return pdf;
 })().catch(error=>{pdfs.delete(file.id);throw error;}));
 return pdfs.get(file.id);
}
export async function downloadOriginal(file){
 const {url}=await original(file),link=document.createElement('a');
 link.href=url;link.download=file.fileName;link.click();
}
async function hydrate(node){
 if(node.dataset.loading)return;
 node.dataset.loading='true';
 const file=store.tasks.flatMap(task=>task.documents||[]).find(file=>file.id===node.dataset.originalDocument);
 if(!file)return;
 try{
  const {url,blob}=await original(file);
  if(!node.isConnected)return;
  if(file.mimeType==='application/pdf'){
   const pdf=await pdfDocument(file,blob),number=Math.min(Number(node.dataset.page)||1,pdf.numPages);
   const page=await pdf.getPage(number);
   if(!node.isConnected)return;
   const base=page.getViewport({scale:1}),scale=node.dataset.zoom==='true'?1:Math.max(1,node.clientWidth)/base.width;
   const viewport=page.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2),canvas=document.createElement('canvas');
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
   canvas.style.cssText=`display:block;width:${viewport.width}px;height:${viewport.height}px;background:white`;
   canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${file.fileName} · Page ${number} of ${pdf.numPages}`);
   await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]}).promise;
   if(!node.isConnected)return;
   node.replaceChildren(canvas);
   const pane=node.closest('.document-pane');
   pane?.querySelectorAll('[data-original-pages]').forEach(el=>el.textContent=String(pdf.numPages));
   const previous=pane?.querySelector('[data-action="doc-prev"]'),next=pane?.querySelector('[data-action="doc-next"]');
   if(previous)previous.disabled=number<=1;if(next)next.disabled=number>=pdf.numPages;
  }else{
   const viewer=document.createElement('img');viewer.src=url;viewer.alt=file.fileName;
   viewer.style.cssText='display:block;width:100%;height:auto;object-fit:contain;background:white';
   viewer.onerror=()=>{files.delete(file.id);showFailure(node);};node.replaceChildren(viewer);
  }
 }catch{showFailure(node);}
}
function showFailure(node){
 if(!node.isConnected)return;
 const message=document.createElement('p');message.className='subtle-note';
 message.textContent='The original file could not be displayed. Download it or retry. ';
 const retry=document.createElement('button');retry.className='btn';retry.type='button';retry.textContent='Retry';
 retry.onclick=()=>{delete node.dataset.loading;void hydrate(node);};
 message.append(retry);node.replaceChildren(message);
}
new MutationObserver(()=>document.querySelectorAll('[data-original-document]:not([data-loading])').forEach(node=>void hydrate(node)))
 .observe(document.body,{childList:true,subtree:true});
window.addEventListener('pagehide',()=>{
 for(const file of files.values())void file.then(({url})=>URL.revokeObjectURL(url)).catch(()=>{});
 for(const pdf of pdfs.values())void pdf.then(document=>document.destroy()).catch(()=>{});
 files.clear();pdfs.clear();pages.clear();
});
