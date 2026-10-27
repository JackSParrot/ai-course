import {readFile,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const origin='https://neural-labs.invalid';
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
export async function buildPortable(root,releaseRoot){
 const publicRoot=join(releaseRoot,'public');
 const manifest=JSON.parse(await readFile(join(releaseRoot,'publication-manifest.json'),'utf8'));
 const asset=async path=>{
  if(!Object.hasOwn(manifest.files,path))throw Error('Portable asset is not published: '+path);
  return readFile(join(publicRoot,path));
 };
 const dataURL=async(path,type)=>'data:'+type+';base64,'+(await asset(path)).toString('base64');
 const assets={};
 for(const file of ['manifest.json','train.bin','validation.bin','test.bin'])assets[file]=await dataURL('/digits/data/'+file,file.endsWith('.json')?'application/json':'application/octet-stream');
 // Only adapt loading and navigation in the portable build. The chapter sources stay shared.
 const plugin={name:'portable-platform',setup(api){
  api.onLoad({filter:/\.js$/},async({path})=>{
   let code=await readFile(path,'utf8');const name=relative(root,path).replaceAll('\\','/');
   // The catalog is shared data: ship it once in the package instead of inside every page bundle.
   if(name==='i18n/en.js')return{contents:'export default globalThis.__NEURAL_PORTABLE__.english;',loader:'js'};
   const replace=(pattern,replacement)=>{const next=code.replace(pattern,replacement);if(next===code)throw Error('Portable adapter no longer matches '+name+': '+pattern);code=next;};
   if(name==='digits/src/data.js'){
    replace("new URL('../data/manifest.json',import.meta.url)","globalThis.__NEURAL_PORTABLE__.assets['manifest.json']");
    replace('new URL(`../data/${spec.file}`,import.meta.url)','globalThis.__NEURAL_PORTABLE__.assets[spec.file]');
   }
   if(name==='digits/src/app.js'||name==='cars/src/training-ui.js')replace(/new Worker\(new URL\(['"]\.\/[^'"]+['"],\s*import\.meta\.url\),\s*\{\s*type:\s*['"]module['"]\s*\}\)/g,'globalThis.__NEURAL_PORTABLE__.worker('+JSON.stringify(name.startsWith('digits/')?'digits':'cars')+')');
   if(name==='assistant/src/app.js')replace(/new Worker\(new URL\(['"]\.\/worker\.js['"],\s*import\.meta\.url\),\s*\{\s*type:\s*['"]module['"]\s*\}\)/g,"globalThis.__NEURAL_PORTABLE__.worker('assistant')");
   if(name==='tools/src/app.js')replace(/new Worker\(new URL\(['"]\.\/worker\.js['"],\s*import\.meta\.url\),\s*\{\s*type:\s*['"]module['"]\s*\}\)/g,"globalThis.__NEURAL_PORTABLE__.worker('tools')");
   if(name==='reasoning/src/app.js')replace(/new Worker\(new URL\(['"]\.\/worker\.js['"],\s*import\.meta\.url\),\s*\{\s*type:\s*['"]module['"]\s*\}\)/g,"globalThis.__NEURAL_PORTABLE__.worker('reasoning')");
   if(name==='attention/src/app.js')replace(/new Worker\(new URL\(['"]\.\/worker\.js['"],\s*import\.meta\.url\),\s*\{\s*type:\s*['"]module['"]\s*\}\)/g,"globalThis.__NEURAL_PORTABLE__.worker('attention')");
   if(name==='predictor/src/app.js')replace(/new Worker\(new URL\(['"]\.\/worker\.js['"],\s*import\.meta\.url\),\s*\{\s*type:\s*['"]module['"]\s*\}\)/g,"globalThis.__NEURAL_PORTABLE__.worker('predictor')");
   if(name==='autoencoder/src/app.js')replace(/new Worker\(new URL\(['"]\.\/worker\.js['"],\s*import\.meta\.url\),\s*\{\s*type:\s*['"]module['"]\s*\}\)/g,"globalThis.__NEURAL_PORTABLE__.worker('images')");
   if(name==='i18n/i18n.js')replace('globalThis.location?.search','globalThis.__NEURAL_PORTABLE__.search');
   if(name==='i18n/dom.js')replace("history.replaceState(null, '', url.pathname + url.search + url.hash);","globalThis.__NEURAL_PORTABLE__.setLanguage(language);");
   if(name==='course/lesson.js'){
    replace("history.replaceState(null,'',hashes[n]);","globalThis.__NEURAL_PORTABLE__.setSlide(hashes[n]);");
    replace(/location\.hash/g,'globalThis.__NEURAL_PORTABLE__.hash');
   }
   return{contents:code,loader:'js'};
  });
 }};
 async function bundle(entry){
  const result=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'portable-entry.js'},bundle:true,write:false,format:'iife',platform:'browser',target:['es2022'],minify:true,plugins:[plugin],logLevel:'silent'});
  return result.outputFiles[0].text;
 }
 const workers={};
 for(const [name,entry]of Object.entries({digits:'digits/src/worker.js',cars:'cars/src/training-worker.js',images:'autoencoder/src/worker.js',predictor:'predictor/src/worker.js',attention:'attention/src/worker.js',assistant:'assistant/src/worker.js',reasoning:'reasoning/src/worker.js',tools:'tools/src/worker.js'}))workers[name]=await bundle('import '+JSON.stringify('./'+entry)+';');
 const provenance=(await asset('/digits/data/PROVENANCE.md')).toString('base64');
 const entries={home:null,perceptrons:'course/lesson.js',digits:'digits/src/app.js',autoencoder:'autoencoder/src/app.js',superresolution:'superresolution/src/app.js',maze:'maze/src/app.js',cars:'cars/src/app.js',tokens:'tokens/src/app.js',predictor:'predictor/src/app.js',attention:'attention/src/app.js',assistant:'assistant/src/app.js',reasoning:'reasoning/src/app.js',tools:'tools/src/app.js',cache:'cache/src/app.js',harness:'harness/src/app.js'},pages={};
 for(const [name,entry]of Object.entries(entries)){
  const path=name==='home'?'/index.html':'/'+name+'/index.html';let html=(await asset(path)).toString('utf8');
  const styles=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
  for(const [tag]of styles){const href=tag.match(/href="([^"]+)"/)[1],css=(await asset(new URL(href,origin+path).pathname)).toString('utf8');html=html.replace(tag,'<style>'+css+'</style>');}
  for(const [tag]of [...html.matchAll(/<link\b[^>]*rel="icon"[^>]*>/g)])html=html.replace(tag,'<link rel="icon" href="'+await dataURL(new URL(tag.match(/href="([^"]+)"/)[1],origin+path).pathname,'image/svg+xml')+'">');
  html=html.replace(/<script\b[^>]*src="[^"]+"[^>]*>\s*<\/script>/g,'');
  html=html.replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>/g,(tag,before,href,after)=>{
   if(href.startsWith('#'))return tag;
   const url=new URL(href,origin+path);if(url.origin!==origin)return '<a'+before+'href="'+href+'"'+after+' target="_blank" rel="noopener">';
   const route=url.pathname==='/'||url.pathname==='/index.html'?'home':url.pathname.match(/^\/(perceptrons|digits|maze|cars|autoencoder|superresolution|tokens|predictor|attention|assistant|reasoning|tools|cache|harness)\/(?:index\.html)?$/)?.[1];
   if(route)return '<a'+before+'href="#/'+(route==='home'?'':route) +'" data-portable-page="'+route+'"'+after+'>';
   if(url.pathname==='/digits/data/PROVENANCE.md')return '<a'+before+'href="data:text/plain;base64,'+provenance+'" download="PROVENANCE.md"'+after+'>';
   throw Error('Unrecognized portable link: '+href);
  });
  const code=await bundle('import "./i18n/dom.js";'+(entry?'import '+JSON.stringify('./'+entry)+';':''));
  pages[name]={html,code};
 }
 const license=await readFile(join(root,'LICENSE'),'utf8');
 const english=(await import(pathToFileURL(join(root,'i18n/en.js')).href)).default;
 const pack={version:1,license,english,pages,assets,workers};
 const host=await readFile(join(root,'scripts/portable/host.js'),'utf8'),frame=await readFile(join(root,'scripts/portable/frame.js'),'utf8');
 pack.frame=frame;
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neural Labs — Curso portable</title><style>html,body{margin:0;width:100%;height:100%;background:#f6f5f0}iframe{display:block;border:0;width:100%;height:100%}#portable-error{font:16px/1.6 system-ui;padding:30px}</style></head><body><p id="portable-error" hidden></p><iframe id="course" title="Neural Labs"></iframe><script id="portable-package" type="application/json">'+json(pack)+'</script><script>'+host.replace(/<\/script/gi,'<\\/script')+'</script></body></html>\n';
 const output=join(releaseRoot,'Neural-Labs.html');await writeFile(output,html);
 return{portable:output,portableBytes:Buffer.byteLength(html)};
}
