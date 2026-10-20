import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {Script,runInNewContext} from 'node:vm';
import {PRESETS} from '../digits/src/model.js';
import {BUILT_IN_MAPS,copyMap} from '../cars/src/maps.js';
import {createDefaultTopologyState} from '../cars/src/topology.js';
import {DEFAULT_TRAINING_SETTINGS} from '../cars/src/training-engine.js';
const output=process.env.LABS_CONTENT_ROOT?resolve(process.env.LABS_CONTENT_ROOT,'Neural-Labs.html'):new URL('../Neural-Labs.html',import.meta.url);
const html=await readFile(output,'utf8'),pack=JSON.parse(html.match(/<script id="portable-package" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const bytes=url=>Buffer.from(url.slice(url.indexOf(',')+1),'base64');

test('one portable file contains every page, styles, locale and all hash-verified MNIST data',()=>{
 assert.deepEqual(Object.keys(pack.pages),['home','perceptrons','digits','cars']);
 for(const page of Object.values(pack.pages)){
  assert.doesNotMatch(page.html,/<script[^>]*src=|<link[^>]*rel="stylesheet"/);
  assert.ok(page.html.includes('<style>'));assert.ok(page.html.includes('data-portable-page='));
  new Script(page.code);assert.ok(page.code.includes('languagechange'));
 }
 const manifest=JSON.parse(bytes(pack.assets['manifest.json']));
 for(const [role,split]of Object.entries(manifest.splits)){
  const pixels=bytes(pack.assets[split.file]);
  assert.equal(pixels.length,split.count*256,role);
  assert.equal(createHash('sha256').update(pixels).digest('hex'),split.sha256,role);
 }
 assert.deepEqual(Object.keys(pack.workers),['digits','cars']);
 for(const worker of Object.values(pack.workers)){new Script(worker);assert.doesNotMatch(worker,/import\.meta/);}
 assert.match(pack.pages.digits.html,/download="PROVENANCE.md"/);
});

test('portable routing preserves inline code, deep slide links, language and back navigation',async()=>{
 const host=await readFile(new URL('../scripts/portable/host.js',import.meta.url),'utf8'),events={},calls=[],frame={contentWindow:{}},error={hidden:true};
 const location={href:'file:///tmp/course.html?lang=en#/perceptrons/or',search:'?lang=en',hash:'#/perceptrons/or'};
 const sandbox={URL,URLSearchParams,decodeURIComponent,encodeURIComponent,localStorage:{getItem:()=>null},location,history:{replaceState(...args){calls.push(args);},pushState(...args){calls.push(args);}},document:{documentElement:{},getElementById:id=>id==='portable-package'?{textContent:JSON.stringify(pack)}:id==='course'?frame:error},addEventListener:(type,fn)=>{events[type]=fn;}};
 runInNewContext(host,sandbox);
 assert.equal(sandbox.__NEURAL_PORTABLE_ROUTE__.page,'perceptrons');assert.equal(sandbox.__NEURAL_PORTABLE_ROUTE__.slide,'#or');assert.equal(sandbox.__NEURAL_PORTABLE_ROUTE__.language,'en');
 assert.ok(frame.srcdoc.includes(pack.pages.perceptrons.code)); // Includes literal $& in the translator.
 events.message({source:{},data:{kind:'portable-navigate',page:'cars'}});assert.ok(frame.srcdoc.includes(pack.pages.perceptrons.code));
 events.message({source:frame.contentWindow,data:{kind:'portable-navigate',page:'cars'}});assert.equal(calls.at(-1)[2],'#/cars');
 location.hash='#/digits';events.popstate();assert.ok(frame.srcdoc.includes(pack.pages.digits.code));
 events.message({source:frame.contentWindow,data:{kind:'portable-language',language:'es'}});assert.ok(calls.at(-1)[2].includes('lang=es'));
});

function trainer(name){
 const bootstrap=`const {parentPort,workerData}=require('node:worker_threads');globalThis.crypto=require('node:crypto').webcrypto;globalThis.self=globalThis;globalThis.onmessage=null;globalThis.__NEURAL_PORTABLE__={assets:workerData};const listeners=[];globalThis.addEventListener=(type,fn)=>{if(type==='message')listeners.push(fn);};globalThis.postMessage=message=>parentPort.postMessage(message);parentPort.on('message',data=>{const event={data};globalThis.onmessage?.(event);listeners.forEach(fn=>fn(event));});`;
 return new Worker(bootstrap+pack.workers[name],{eval:true,workerData:pack.assets});
}
function next(worker,message,predicate=()=>true){
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>finish(Error('Portable worker timed out')),15000);
  function finish(error,value){clearTimeout(timeout);worker.off('message',receive);worker.off('error',fail);if(error)reject(error);else resolve(value);}
  function fail(error){finish(error);}
  function receive(value){if(value.type==='error'||value.kind==='error')finish(Error(value.message));else if(predicate(value))finish(null,value);}
  worker.on('message',receive);worker.once('error',fail);worker.postMessage(message);
 });
}
test('the embedded image trainer loads its embedded dataset and updates real weights',async t=>{
 const worker=trainer('digits');t.after(()=>worker.terminate());
 const initial=await next(worker,{type:'init',types:[PRESETS[0]],custom:[],config:{mode:'epochs',epochs:1,seconds:1,batchSize:32,lr:.1,seed:42}});
 assert.equal(initial.experiment.models[0].batches,0);
 const trained=await next(worker,{type:'step'});
 assert.equal(trained.experiment.models[0].batches,1);
 assert.notDeepEqual(trained.experiment.models[0].network.layers[0].w,initial.experiment.models[0].network.layers[0].w);
});
test('the embedded car trainer evaluates a population without importing external modules',async t=>{
 const worker=trainer('cars');t.after(()=>worker.terminate());
 const setup={maps:BUILT_IN_MAPS.slice(0,3).map(copyMap),types:[createDefaultTopologyState().types[2]],settings:{...DEFAULT_TRAINING_SETTINGS,population:8,generations:1}};
 const initial=await next(worker,{command:'init',setup});assert.equal(initial.state.phase,'evaluate');
 const result=await next(worker,{command:'step'},value=>value.state.phase!=='evaluate');
 assert.equal(result.state.phase,'select');assert.ok(result.state.groups[0].population.every(member=>Number.isFinite(member.fitness.score)));
});
