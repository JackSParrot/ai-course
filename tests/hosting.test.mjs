import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createServer} from '../scripts/server.mjs';
const manifest=JSON.parse(await readFile(process.env.LABS_CONTENT_ROOT?resolve(process.env.LABS_CONTENT_ROOT,'publication-manifest.json'):new URL('../publication-manifest.json',import.meta.url)));
const server=await createServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const port=server.address().port,origin=`http://127.0.0.1:${port}`;
function raw(path,method='GET'){return new Promise((ok,fail)=>{const req=http.request({hostname:'127.0.0.1',port,path,method},r=>{let b='';r.on('data',x=>b+=x);r.on('end',()=>ok({status:r.statusCode,body:b,headers:r.headers}));});req.on('error',fail);req.end();});}
test.after(()=>new Promise(ok=>server.close(ok)));
test('all sixteen chapters form one continuous route from perceptrons to memory',async()=>{
 const chapters=['perceptrons','digits','autoencoder','superresolution','maze','cars','tokens','predictor','attention','assistant','reasoning','tools','cache','harness','skills','memory'];
 for(const [index,chapter]of chapters.entries()){
  const html=await(await fetch(origin+'/'+chapter+'/')).text();
  assert.ok(html.includes('CAPÍTULO '+String(index+1).padStart(2,'0')+' / 16'),chapter);
  if(index>0)assert.ok(html.includes('class="course-previous" href="../'+chapters[index-1]+'/"'),chapter);
  if(index<chapters.length-1)assert.ok(html.includes('class="course-next" href="../'+chapters[index+1]+'/"'),chapter);
 }
 const home=await(await fetch(origin+'/')).text();assert.ok(home.includes('href="./maze/"'));assert.ok(home.includes('CAPÍTULO 06 · COCHES'));assert.ok(home.includes('href="./tokens/"'));assert.ok(home.includes('CAPÍTULO 07 · TOKENS'));assert.ok(home.includes('href="./predictor/"'));assert.ok(home.includes('CAPÍTULO 08 · SIGUIENTE TOKEN'));assert.ok(home.includes('href="./attention/"'));assert.ok(home.includes('CAPÍTULO 09 · ATENCIÓN'));assert.ok(home.includes('href="./assistant/"'));assert.ok(home.includes('CAPÍTULO 10 · DEL MODELO AL ASISTENTE'));assert.ok(home.includes('href="./reasoning/"'));assert.ok(home.includes('CAPÍTULO 11 · PENSAR ANTES DE RESPONDER'));assert.ok(home.includes('href="./tools/"'));assert.ok(home.includes('CAPÍTULO 12 · HERRAMIENTAS Y AGENTES'));assert.ok(home.includes('href="./cache/"'));assert.ok(home.includes('CAPÍTULO 13 · CACHÉ Y COSTE'));assert.ok(home.includes('href="./harness/"'));assert.ok(home.includes('CAPÍTULO 14 · EL ARNÉS'));assert.ok(home.includes('href="./skills/"'));assert.ok(home.includes('CAPÍTULO 15 · SKILLS Y MCP'));assert.ok(home.includes('href="./memory/"'));assert.ok(home.includes('CAPÍTULO 16 · LA MEMORIA'));
});
test('changed course assets use content-versioned URLs for returning visitors',async()=>{
 const home=await(await fetch(origin+'/')).text();
 assert.ok(home.includes('./landing.css?v='+manifest.files['/landing.css'].sha256.slice(0,12)));
 for(const route of ['/perceptrons/','/digits/','/maze/','/cars/','/autoencoder/','/superresolution/','/tokens/','/predictor/','/attention/','/assistant/','/reasoning/','/tools/','/cache/','/harness/','/skills/','/memory/']){
  const html=await(await fetch(origin+route)).text();
  assert.ok(html.includes('../hub-nav.css?v='+manifest.files['/hub-nav.css'].sha256.slice(0,12)),route);
 }
 const intro=await(await fetch(origin+'/perceptrons/')).text();
 const version=intro.match(/course\.css\?v=([a-f0-9]{12})/)[1];
 assert.ok(intro.includes('./lesson.js?v='+version));
 assert.ok((await(await fetch(origin+'/perceptrons/lesson.js')).text()).includes('./math.js?v='+version));
 const digits=await(await fetch(origin+'/digits/')).text();
 const digitsVersion=digits.match(/styles\.css\?v=([a-f0-9]{12})/)[1];
 assert.ok(digits.includes('./src/app.js?v='+digitsVersion));
 const app=await(await fetch(origin+'/digits/src/app.js')).text();
 assert.ok(app.includes('./inspector.js?v='+digitsVersion));
 assert.ok(app.includes('./worker.js?v='+digitsVersion));
 assert.ok((await(await fetch(origin+'/digits/src/inspector.js?v='+digitsVersion)).text()).includes('inspectNeuron'));
 const tokens=await(await fetch(origin+'/tokens/')).text();
 const tokensVersion=tokens.match(/styles\.css\?v=([a-f0-9]{12})/)[1];
 assert.ok(tokens.includes('./src/app.js?v='+tokensVersion));
 const predictor=await(await fetch(origin+'/predictor/')).text();
 assert.ok(predictor.includes('../tokens/styles.css?v='+tokensVersion));
 const predictorApp=await(await fetch(origin+'/predictor/src/app.js')).text();
 assert.ok(predictorApp.includes('./worker.js?v='+tokensVersion));
 assert.ok(predictorApp.includes('../../tokens/src/bpe.js?v='+tokensVersion));
 const attentionApp=await(await fetch(origin+'/attention/src/app.js')).text();
 assert.ok(attentionApp.includes('../../predictor/src/model.js?v='+tokensVersion));
 assert.ok(attentionApp.includes('./worker.js?v='+tokensVersion));
 const assistantApp=await(await fetch(origin+'/assistant/src/app.js')).text();
 assert.ok(assistantApp.includes('../../attention/src/transformer.js?v='+tokensVersion));

});
test('the course index and all sixteen chapter routes, canonical subpaths, HEAD and cache validators work',async()=>{for(const path of ['/','/perceptrons/','/digits/','/maze/','/cars/','/autoencoder/','/superresolution/','/tokens/','/predictor/','/attention/','/assistant/','/reasoning/','/tools/','/cache/','/harness/','/skills/','/memory/']){const r=await fetch(origin+path);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/^text\/html/);assert.equal((await fetch(origin+path,{method:'HEAD'})).status,200);assert.equal((await fetch(origin+path,{headers:{'If-None-Match':r.headers.get('etag')}})).status,304);}for(const path of ['/perceptrons','/digits','/maze','/cars','/autoencoder','/superresolution','/tokens','/predictor','/attention','/assistant','/reasoning']){const r=await fetch(origin+path,{redirect:'manual'});assert.equal(r.status,308);assert.equal(r.headers.get('location'),path+'/');}});
test('all 109 allowlisted resources serve exact published bytes with correct MIME types',async()=>{assert.equal(Object.keys(manifest.files).length,109);for(const [path,spec]of Object.entries(manifest.files)){const r=await fetch(origin+path);assert.equal(r.status,200,path);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.length,spec.bytes,path);assert.equal(createHash('sha256').update(b).digest('hex'),spec.sha256,path);assert.equal(r.headers.get('x-content-type-options'),'nosniff');if(path.endsWith('.js'))assert.match(r.headers.get('content-type'),/^text\/javascript/);}});
test('relative module dependencies, HTML assets and both Web Workers resolve under subpaths',async()=>{for(const path of Object.keys(manifest.files)){if(!/\.(html|js)$/.test(path))continue;const source=await(await fetch(origin+path)).text();const links=path.endsWith('.html')?[...source.matchAll(/(?:href|src)="([^\"]+)"/g)].map(x=>x[1]):[...source.matchAll(/(?:from\s*|import\s*|new URL\(\s*)["'](\.[^"']+)["']/g)].map(x=>x[1]);for(const href of links){if(/^(#|https?:|data:|blob:)/.test(href))continue;const url=new URL(href,origin+path);assert.equal((await fetch(url)).status,200,`${path} -> ${href}`);}}
for(const path of ['/cars/src/training-worker.js','/digits/src/worker.js','/predictor/src/worker.js','/attention/src/worker.js','/assistant/src/worker.js']){const r=await fetch(origin+path);assert.match(r.headers.get('content-type'),/^text\/javascript/);assert.match(r.headers.get('content-security-policy'),/worker-src 'self'/);}});
test('source assets are preserved except navigation and content-versioned module imports',async()=>{for(const [path,spec]of Object.entries(manifest.sources)){if(path.endsWith('/index.html'))continue;if(/^(digits|tokens|predictor|attention|assistant|reasoning|tools|cache|harness|skills|memory)\//.test(path)&&path.endsWith('.js')){
 const published=await(await fetch(origin+'/'+path)).text();
 const source=published.replace(/(['"])(\.\.\/(?:\.\.\/)?i18n\/i18n\.js)\?v=[a-f0-9]{12}\1/g,(_,quote,url)=>quote+url+quote).replace(/(['"])(\.\/[a-z-]+\.js|\.\.\/\.\.\/(?:tokens|predictor|attention|assistant)\/src\/[a-z-]+\.js)\?v=[a-f0-9]{12}\1/g,(_,quote,url)=>quote+url+quote);
 assert.equal(createHash('sha256').update(source).digest('hex'),spec.sha256,path);
 }else if(path.endsWith('.js')){
 const published=await(await fetch(origin+'/'+path)).text();
 const source=published.replace(/(['"])(\.\.\/(?:\.\.\/)?i18n\/i18n\.js)\?v=[a-f0-9]{12}\1/g,(_,quote,url)=>quote+url+quote);
 assert.equal(createHash('sha256').update(source).digest('hex'),spec.sha256,path);
 }else assert.equal(manifest.files['/'+path].sha256,spec.sha256,path);}for(const path of ['/perceptrons/','/digits/','/maze/','/cars/','/autoencoder/','/superresolution/','/tokens/','/predictor/','/attention/','/assistant/','/reasoning/','/tools/','/cache/','/harness/','/skills/','/memory/']){const html=await(await fetch(origin+path)).text();assert.match(html,/id="hub-nav"/);assert.match(html,/aria-current="page"/);assert.match(html,/Volver al curso/);assert.match(html,/class="course-bottom-nav"/);}});
test('only intended static resources are exposed, no traversal, code roots or directory listings',async()=>{for(const path of ['/scripts/server.mjs','/scripts/build.mjs','/scripts/peer-guard.mjs','/scripts/portable/build.mjs','/server.mjs','/build.mjs','/publication-manifest.json','/.env','/.git/config','/cars/package.json','/cars/server.js','/cars/README.md','/cars/tests/training.test.js','/digits/verification/verified-experiment.json','/digits/.openai/hosting.json','/cars/src/','/digits/data/','/../server.mjs','/%2e%2e/server.mjs','/cars/..%5c..%5cserver.mjs','/cars/%00index.html','/C:/Windows/win.ini'])assert.equal((await raw(path)).status,404,path);assert.equal((await raw('/%xx')).status,400);assert.equal((await raw('/','POST')).status,405);assert.equal((await raw('/','HEAD')).body,'');});
test('separate storage namespaces, deterministic binary dataset paths and no transport of browser state',async()=>{const car=await(await fetch(origin+'/cars/src/topology-store.js')).text();const digit=await(await fetch(origin+'/digits/src/app.js')).text();assert.match(car,/neural-racing\.topologies\.v1/);assert.match(digit,/neural-digits\.topologies\.v1/);const m=await(await fetch(origin+'/digits/data/manifest.json')).json();for(const role of ['train','validation','test']){const b=Buffer.from(await(await fetch(origin+'/digits/data/'+m.splits[role].file)).arrayBuffer());assert.equal(createHash('sha256').update(b).digest('hex'),m.splits[role].sha256);}assert.equal((await raw('/save','POST')).status,405);});
