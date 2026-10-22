import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNetwork,forward,decode,gradients,clearGradients,trainBatch,mse,snapshot,restore,inspectNeuron,inspect} from '../autoencoder/src/network.js';
import {dataset,reduce,resize,image} from '../autoencoder/src/data.js';
import {inspectionGrid,layout} from '../autoencoder/src/viewer.js';

for(const task of ['autoencoder','superresolution']){
 test(task+': every visible activation and inspector contribution matches the real forward pass',()=>{
  const network=createNetwork(task),s=dataset(task,'test')[0],trace=forward(network,s.input);
  assert.equal(trace.output.length,576);
  assert.deepEqual(trace.states.map(s=>[s.w,s.h,s.c]),task==='autoencoder'?[[24,24,1],[12,12,4],[6,6,4],[12,12,4],[12,12,4],[24,24,4],[24,24,1]]:[[12,12,1],[12,12,8],[24,24,8],[24,24,1]]);
  for(let stage=0;stage<trace.states.length;stage++)for(let index=0;index<trace.states[stage].data.length;index++){
   const d=inspectNeuron(network,trace,stage,index);assert.equal(d.activation,trace.states[stage].data[index]);
   if(d.kind==='input')continue;
   const sum=d.entries.reduce((n,e)=>{assert.equal(e.product,e.value*e.weight);if(e.inputIndex!==null)assert.equal(e.value,trace.states[stage-1].data[e.inputIndex]);return n+e.product;},d.bias);
   assert.ok(Math.abs(sum-d.sum)<1e-10);
   const activation=d.kind==='up'?sum:d.function==='tanh'?Math.tanh(sum):1/(1+Math.exp(-sum));assert.ok(Math.abs(activation-d.activation)<1e-6);
  }
  const first=inspect(network,s.input,0,0,0),detail=inspectNeuron(network,trace,1,0);assert.ok(Math.abs(first.sum-detail.sum)<1e-10);assert.ok(detail.entries.some(e=>e.padded));
  if(task==='autoencoder'){assert.equal(trace.latent.data.length,144);assert.deepEqual(decode(network,trace.latent.data),trace.output);const code=trace.latent.data.slice();code[50]=.95;const modified=forward(network,s.input,code);assert.deepEqual(modified.output,decode(network,code));assert.notDeepEqual(modified.output,trace.output);const edited=inspectNeuron(network,modified,2,50);assert.equal(edited.overridden,true);assert.ok(Math.abs(edited.calculated-Math.tanh(edited.sum))<1e-6);assert.equal(edited.activation,code[50]);}
 });
 test(task+': backpropagation through every convolution and upsampling agrees with finite differences',()=>{
  const n=createNetwork(task),s=dataset(task)[4];clearGradients(n);gradients(n,s.input,s.target);
  for(const l of n.layers.filter(l=>l.type==='conv'))for(const key of ['w','b'])for(const index of new Set([0,Math.floor(l[key].length/2),l[key].length-1])){
   const original=l[key][index],epsilon=.003,analytic=l['g'+key][index];l[key][index]=original+epsilon;const high=mse(forward(n,s.input).output,s.target);l[key][index]=original-epsilon;const low=mse(forward(n,s.input).output,s.target);l[key][index]=original;
   const numeric=(high-low)/(2*epsilon);assert.ok(Math.abs(numeric-analytic)<2e-5+Math.abs(analytic)*.015,`${key}[${index}]: ${numeric} vs ${analytic}`);
  }
 });
 test(task+': training reduces held-out error and serialization preserves exact predictions',()=>{
  const n=createNetwork(task),train=dataset(task),val=dataset(task,'validation');const loss=()=>val.reduce((n,s)=>n+mse(forward(network,s.input).output,s.target),0)/val.length;let network=n;const before=loss();
  for(let epoch=0;epoch<30;epoch++)for(let i=0;i<train.length;i+=8)trainBatch(n,train.slice(i,i+8));
  const after=loss();assert.ok(after<before*.15,`${before} → ${after}`);
  if(task==='superresolution'){const baseline=val.reduce((n,s)=>n+mse(resize(s.input,12),s.target),0)/val.length;assert.ok(after<baseline,`${after} < ${baseline}`);}
  const copy=restore(snapshot(n),task);assert.deepEqual(forward(copy,val[0].input).output,forward(n,val[0].input).output);
  const malformed=snapshot(n);malformed.weights[0].w[0]=null;assert.throws(()=>restore(malformed,task));assert.throws(()=>restore(snapshot(n),task==='autoencoder'?'superresolution':'autoencoder'));
 });
}
test('procedural splits are deterministic, pixel-disjoint and all use valid greyscale values',()=>{
 const hashes=new Set();for(const split of ['train','validation','test'])for(const s of dataset('autoencoder',split)){
  assert.ok(s.input.every(v=>v>=0&&v<=1));const hash=createHash('sha256').update(Buffer.from(s.input.buffer)).digest('hex');assert.ok(!hashes.has(hash));hashes.add(hash);
 }
 assert.equal(hashes.size,176);assert.deepEqual(image(42),image(42));assert.notDeepEqual(image(42),image(43));
 const s=dataset('superresolution')[0];assert.deepEqual(reduce(s.target),s.input);
});
test('block averaging and the two baseline resizers preserve constant images and correct block alignment',()=>{
 const input=new Float32Array(576).fill(.3),low=reduce(input);for(const v of low)assert.ok(Math.abs(v-.3)<1e-6);
 for(const method of ['nearest','bilinear'])assert.ok(resize(low,12,method).every(v=>Math.abs(v-.3)<1e-6));
 const impulse=new Float32Array(144);impulse[0]=1;const nearest=resize(impulse,12,'nearest');assert.equal(nearest[0],1);assert.equal(nearest[1],1);assert.equal(nearest[24],1);assert.equal(nearest[25],1);assert.equal(nearest[2],0);
});
test('full viewer retains every activation and every filter cell keeps its 3 × 3 input-map position',()=>{
 for(const task of ['autoencoder','superresolution']){
  const network=createNetwork(task),trace=forward(network,dataset(task)[0].input),world=layout(trace.states);
  assert.deepEqual(world.layers.map(l=>l.nodes.length),trace.states.map(s=>s.data.length));
  for(const [stage,l]of world.layers.entries())for(const [i,n]of l.nodes.entries()){assert.equal(n.index,i);assert.equal(n.stage,stage);}
 }
 for(const count of [1,9,36,72]){
  const g=inspectionGrid(count);assert.equal(new Set(g.positions.map(p=>p.x+','+p.y)).size,count);
  g.positions.forEach(p=>assert.ok(p.x>=0&&p.x<g.cols&&p.y>=0&&p.y<g.rows));
  if(count>1)for(let map=0;map<count/9;map++){const block=g.positions.slice(map*9,map*9+9);assert.equal(new Set(block.map(p=>p.x)).size,3);assert.equal(new Set(block.map(p=>p.y)).size,3);}
 }
});
