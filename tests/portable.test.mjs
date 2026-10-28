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
 assert.deepEqual(Object.keys(pack.pages),['home','perceptrons','digits','autoencoder','superresolution','maze','cars','tokens','predictor','attention','assistant','reasoning','tools','cache','harness','skills','memory']);
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
 assert.deepEqual(Object.keys(pack.workers),['digits','cars','images','predictor','attention','assistant','reasoning']);
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
 events.message({source:frame.contentWindow,data:{kind:'portable-navigate',page:'maze'}});assert.equal(calls.at(-1)[2],'#/maze');
 location.hash='#/digits';events.popstate();assert.ok(frame.srcdoc.includes(pack.pages.digits.code));
 events.message({source:frame.contentWindow,data:{kind:'portable-language',language:'es'}});assert.ok(calls.at(-1)[2].includes('lang=es'));
});

test('portable explanation anchors stay inside their chapter rather than nesting the host file',async()=>{
 const source=await readFile(new URL('../scripts/portable/frame.js',import.meta.url),'utf8');
 const events={},messages=[],actions=[];
 const target={scrollIntoView:()=>actions.push('scroll'),setAttribute:(key,value)=>actions.push([key,value]),focus:()=>actions.push('focus')};
 const anchor={getAttribute:()=> '#guide'};
 const sandbox={URL,decodeURIComponent,document:{querySelectorAll:()=>[],addEventListener:(kind,fn)=>events[kind]=fn,getElementById:id=>id==='guide'?target:null},parent:{__NEURAL_PORTABLE_PACKAGE__:pack,__NEURAL_PORTABLE_ROUTE__:{language:'es',slide:''},location:{href:'file:///tmp/Neural-Labs.html#/maze'},postMessage:message=>messages.push(message)},addEventListener:()=>{}};
 runInNewContext(source,sandbox);
 events.click({button:0,target:{closest:selector=>selector==='a[href^="#"]'?anchor:null},preventDefault:()=>actions.push('prevent')});
 assert.deepEqual(actions,['prevent','scroll',['tabindex','-1'],'focus']);assert.equal(messages.length,0);
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

for(const task of ['autoencoder','superresolution'])test('portable '+task+' worker trains, pauses, and resets without external assets',async t=>{
 const worker=trainer('images');t.after(()=>worker.terminate());
 const initial=await next(worker,{kind:'init',task});assert.equal(initial.kind,'ready');assert.equal(initial.epoch,0);assert.equal(initial.model.task,task);
 const trained=await next(worker,{kind:'train',epochs:1},m=>m.epoch===1&&!m.running);
 assert.ok(trained.history.at(-1).validation<initial.history[0].validation);assert.notDeepEqual(trained.model.weights,initial.model.weights);
 await next(worker,{kind:'train',epochs:30},m=>m.running);
 const paused=await next(worker,{kind:'pause'},m=>!m.running);assert.equal(paused.running,false);
 const reset=await next(worker,{kind:'init',task});assert.deepEqual(reset.model,initial.model);assert.equal(reset.epoch,0);
});
test('the embedded car trainer evaluates a population without importing external modules',async t=>{
 const worker=trainer('cars');t.after(()=>worker.terminate());
 const setup={maps:BUILT_IN_MAPS.slice(0,3).map(copyMap),types:[createDefaultTopologyState().types[2]],settings:{...DEFAULT_TRAINING_SETTINGS,population:8,generations:1}};
 const initial=await next(worker,{command:'init',setup});assert.equal(initial.state.phase,'evaluate');
 const result=await next(worker,{command:'step'},value=>value.state.phase!=='evaluate');
 assert.equal(result.state.phase,'select');assert.ok(result.state.groups[0].population.every(member=>Number.isFinite(member.fitness.score)));
});
test('the embedded next-token trainer learns, pauses and resets without external modules',async t=>{
 const worker=trainer('predictor');t.after(()=>worker.terminate());
 const sequence=Array.from({length:240},(_,i)=>2+i%5);
 const setup={kind:'reset',vocabularySize:8,settings:{context:2,hidden:8,embedding:4},train:sequence,validation:sequence.slice(0,40)};
 const initial=await next(worker,setup,m=>m.kind==='reset');assert.equal(initial.epoch,0);
 const trained=await next(worker,{kind:'train',epochs:3},m=>m.kind==='progress'&&m.epoch===3&&!m.running);
 assert.ok(trained.history.at(-1).validationLoss<initial.history[0].validationLoss);assert.ok(trained.history.at(-1).accuracy>.9);
 await next(worker,{kind:'train',epochs:200},m=>m.running);
 const paused=await next(worker,{kind:'pause'},m=>m.kind==='progress'&&!m.running);assert.equal(paused.running,false);
 const reset=await next(worker,setup,m=>m.kind==='reset');assert.deepEqual(reset.model,initial.model);
});
test('the embedded attention trainer compares both networks, pauses and resets without external modules',async t=>{
 const worker=trainer('attention');t.after(()=>worker.terminate());
 const lines=Array.from({length:60},(_,i)=>[2+i%3,6,7,8,9,10,2+i%3]);
 const setup={kind:'reset',vocabularySize:12,train:lines,validation:lines.slice(0,6),stories:lines.slice(0,6).map(line=>({line,at:6}))};
 const initial=await next(worker,setup,m=>m.kind==='reset');assert.equal(initial.history.length,1);assert.ok('story' in initial.history[0].transformer);
 const trained=await next(worker,{kind:'train',epochs:1},m=>m.kind==='progress'&&m.epoch===1&&!m.running);assert.equal(trained.history.length,2);
 await next(worker,{kind:'train',epochs:200},m=>m.running);
 const paused=await next(worker,{kind:'pause'},m=>m.kind==='progress'&&!m.running);assert.equal(paused.running,false);
 const reset=await next(worker,setup,m=>m.kind==='reset');assert.deepEqual(reset.transformer,initial.transformer);
});
test('the embedded assistant trainer runs all three stages without external modules',async t=>{
 const worker=trainer('assistant');t.after(()=>worker.terminate());
 const tokenizer={kind:'neural-labs-bpe',version:1,chars:['a','b',' ','.','⏹'],merges:[]};
 const tokens=[null,null,256,257,258,259,260];
 const question={prompt:[2,4,3,4],reply:[4,5,6],place:'x',opinion:'y'};
 worker.postMessage({kind:'setup',vocabularySize:7,stop:6,tokenizer,tokens,pretrain:[[2,3,4],[3,2,5]],instructions:[question,question],preferences:[question],test:[question]});
 const base=await next(worker,{kind:'pretrain'},m=>m.kind==='stage');assert.equal(base.stage,'base');
 const assistant=await next(worker,{kind:'instruct'},m=>m.kind==='stage');assert.equal(assistant.stage,'assistant');assert.ok('truthful' in assistant.metrics);
 const tuned=await next(worker,{kind:'prefer',settings:{likesAgreement:1,checksFacts:0,rounds:1}},m=>m.kind==='stage');assert.equal(tuned.stage,'tuned');assert.equal(tuned.history.length,2);
});
test('the embedded reasoning trainer builds its own games and trains both models',async t=>{
 const worker=trainer('reasoning');t.after(()=>worker.terminate());
 worker.postMessage({kind:'setup',tokenizer:null});
 const epoch=await next(worker,{kind:'compare'},m=>m.kind==='epoch');
 assert.equal(epoch.history.length,1);assert.ok(epoch.history[0].think>=0&&epoch.history[0].direct>=0);
 worker.postMessage({kind:'stop'});
});
