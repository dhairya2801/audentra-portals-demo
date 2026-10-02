// Credentialed originals stay in memory; they are never written to browser preview storage.
import {boardRequest} from './identities.js';
import {store} from './store.js';
const files=new Map(),pdfs=new Map(),pages=new Map(),reads=new Map();
let pdfLibrary;
async function original(file){
 if(files.has(file.id))return files.get(file.id);
 const controller=new AbortController();reads.set(file.id,controller);
 const pending=boardRequest('demo-document',{path:file.contentPath},controller.signal).then(blob=>{
  if(controller.signal.aborted)throw new DOMException('Preview closed','AbortError');
  if(!(blob instanceof Blob))throw Error('Original unavailable');
  return {blob,url:URL.createObjectURL(blob)};
 }).catch(error=>{if(files.get(file.id)===pending)files.delete(file.id);throw error;});
 files.set(file.id,pending);return pending;
}
export function originalPageCount(id){return pages.get(id)||1;}
async function pdfDocument(file,blob){
 if(!pdfs.has(file.id)){
  const controller=reads.get(file.id);
  const pending=(async()=>{
   pdfLibrary ||= import('/document-viewer/build/pdf.min.mjs');
   const lib=await pdfLibrary;lib.GlobalWorkerOptions.workerSrc='/document-viewer/build/pdf.worker.min.mjs';
   const bytes=new Uint8Array(await blob.arrayBuffer());
   if(controller?.signal.aborted)throw new DOMException('Preview closed','AbortError');
   const task=lib.getDocument({data:bytes,cMapUrl:'/document-viewer/cmaps/',cMapPacked:true,
    standardFontDataUrl:'/document-viewer/standard_fonts/',wasmUrl:'/document-viewer/wasm/'});
   const cancel=()=>void task.destroy();controller?.signal.addEventListener('abort',cancel,{once:true});
   try{
    const pdf=await task.promise;
    if(controller?.signal.aborted){await pdf.destroy();throw new DOMException('Preview closed','AbortError');}
    pages.set(file.id,pdf.numPages);return pdf;
   }finally{controller?.signal.removeEventListener('abort',cancel);}
  })().catch(error=>{if(pdfs.get(file.id)===pending)pdfs.delete(file.id);throw error;});
  pdfs.set(file.id,pending);
 }
 return pdfs.get(file.id);
}
function mounted(node){return node.isConnected&&!!node.closest('dialog[open]');}
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
  if(!mounted(node))return;
  if(file.mimeType==='application/pdf'){
   const pdf=await pdfDocument(file,blob),number=Math.min(Number(node.dataset.page)||1,pdf.numPages);
   const page=await pdf.getPage(number);
   if(!mounted(node))return;
   const base=page.getViewport({scale:1}),scale=node.dataset.zoom==='true'?1:Math.max(1,node.clientWidth)/base.width;
   const viewport=page.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2),canvas=document.createElement('canvas');
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
   canvas.style.cssText=`display:block;width:${viewport.width}px;height:${viewport.height}px;background:white`;
   canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${file.fileName} · Page ${number} of ${pdf.numPages}`);
   await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]}).promise;
   if(!mounted(node))return;
   node.replaceChildren(canvas);
   const pane=node.closest('.document-pane');
   pane?.querySelectorAll('[data-original-pages]').forEach(el=>el.textContent=String(pdf.numPages));
   const previous=pane?.querySelector('[data-action="doc-prev"]'),next=pane?.querySelector('[data-action="doc-next"]');
   if(previous)previous.disabled=number<=1;if(next)next.disabled=number>=pdf.numPages;
  }else{
   const viewer=document.createElement('img');viewer.src=url;viewer.alt=file.fileName;
   viewer.style.cssText='display:block;width:100%;height:auto;object-fit:contain;background:white';
   viewer.onerror=()=>showFailure(node);node.replaceChildren(viewer);
  }
 }catch(error){showFailure(node,error);}
}
function showFailure(node,error){
 if(!mounted(node))return;
 const message=document.createElement('p');message.className='subtle-note';
 message.textContent=error?.code==='UNAUTHORIZED' ? 'Your staff session has expired. Sign in again, then retry. ' : 'The original file could not be displayed. Download it or retry. ';
 const retry=document.createElement('button');retry.className='btn';retry.type='button';retry.textContent='Retry';
 retry.onclick=()=>{release(node.dataset.originalDocument);delete node.dataset.loading;void hydrate(node);};
 message.append(retry);node.replaceChildren(message);
}
// Retain bytes only while their preview is mounted. Reopening reauthorizes the
// request; closing also cancels slow reads and destroys PDF workers/blob URLs.
function release(id){
 reads.get(id)?.abort();reads.delete(id);
 const file=files.get(id);files.delete(id);
 if(file)void file.then(({url})=>URL.revokeObjectURL(url)).catch(()=>{});
 const pdf=pdfs.get(id);pdfs.delete(id);pages.delete(id);
 if(pdf)void pdf.then(document=>document.destroy()).catch(()=>{});
}
new MutationObserver(()=>{
 const mounted=new Set([...document.querySelectorAll('dialog[open] [data-original-document]')].map(node=>node.dataset.originalDocument));
 for(const id of reads.keys())if(!mounted.has(id))release(id);
 document.querySelectorAll('dialog[open] [data-original-document]:not([data-loading])').forEach(node=>void hydrate(node));
}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
window.addEventListener('pagehide',()=>{for(const id of reads.keys())release(id);});
