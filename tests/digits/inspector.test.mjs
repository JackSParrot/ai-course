import test from 'node:test';
import assert from 'node:assert/strict';
import {Network,PRESETS,clone,inputVector} from '../../digits/src/model.js';
import {inspectNeuron,incomingGrid,connectionAt,finiteIndex,neuronSelection,numberText} from '../../digits/src/inspector.js';
import {drawInspectorMap} from '../../digits/src/view.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
function fixture(activation='relu'){
 const n=new Network({...clone(PRESETS[1]),hidden:[2],activation,inputMode:'raw'});
 for(const l of n.layers){l.w.fill(0);l.b.fill(0);}
 n.layers[0].w[0]=2;n.layers[0].w[1]=-1;n.layers[0].b[0]=-3;
 n.layers[0].w[256]=-1;n.layers[0].w[257]=3;n.layers[0].b[1]=1;
 n.layers[1].w[14]=2;n.layers[1].w[15]=-.5;n.layers[1].b[7]=.25;
 const p=Array(256).fill(0);p[0]=3;p[1]=2;
 return {n,p};
}
test('paired first-layer tensors expose actual scaled/masked inputs and exact incoming weight indices',()=>{
 const p=Array.from({length:256},(_,i)=>i);
 for(const mode of ['normalized','centered','raw']){
  const t={...clone(PRESETS[0]),inputMode:mode};t.mask[0]=0;t.mask[255]=0;
  const n=new Network(t,8),r=inspectNeuron(n,p,0,9);
  assert.deepEqual(r.input,inputVector(p,t));assert.equal(r.input[0],0);assert.equal(r.input[255],0);
  assert.equal(r.inputKind,'pixels');assert.equal(r.grid.columns,16);assert.equal(r.grid.rows,16);
  for(let i=0;i<256;i++){assert.equal(r.terms[i].i,i);assert.equal(r.weights[i],n.layers[0].w[9*256+i]);assert.equal(r.terms[i].a,r.input[i]);close(r.terms[i].contribution,r.input[i]*r.weights[i]);}
  assert.equal(r.masked[255],true);assert.ok(r.inputDescription.includes('máscara'));
 }
});
test('later-layer images are the previous activations, not the original digit pixels',()=>{
 const {n,p}=fixture(),hidden=inspectNeuron(n,p,0,0),output=inspectNeuron(n,p,1,7);
 assert.equal(hidden.weightedSum,4);assert.equal(hidden.bias,-3);assert.equal(hidden.z,1);assert.equal(hidden.activation,1);
 assert.deepEqual(Array.from(output.input),[1,4]);assert.deepEqual(Array.from(output.weights),[2,-.5]);
 assert.equal(output.weightedSum,0);assert.equal(output.bias,.25);assert.equal(output.z,.25);
 close(output.activation,Math.exp(.25)/(Math.exp(.25)+9));assert.equal(output.inputKind,'activations');
 assert.match(output.inputDescription,/2 activaciones de la capa oculta 1/);assert.match(output.inputDescription,/no píxeles/);
 assert.deepEqual(output.terms.map(t=>t.i),[0,1]);
});
test('all presets and arbitrary deeper layers preserve each incoming connection and each activation function',()=>{
 const pixels=Array.from({length:256},(_,i)=>(i*7)%256);
 for(const activation of ['relu','sigmoid','tanh'])for(const topology of [...PRESETS,{...clone(PRESETS[1]),hidden:[5,3,1]}]){
  const n=new Network({...clone(topology),activation,inputMode:'centered'},9),trace=n.forward(inputVector(pixels,n.topology));
  for(let layer=0;layer<n.layers.length;layer++)for(const neuron of new Set([0,n.layers[layer].b.length-1])){
   const r=inspectNeuron(n,pixels,layer,neuron);
   assert.deepEqual(r.input,trace.a[layer]);assert.equal(r.terms.length,n.sizes[layer]);
   assert.equal(r.activation,trace.a[layer+1][neuron]);assert.equal(r.z,trace.z[layer][neuron]);
   close(r.weightedSum+r.bias,r.z);
   for(let i=0;i<r.terms.length;i++){
    assert.equal(r.weights[i],n.layers[layer].w[neuron*n.sizes[layer]+i]);
    assert.equal(r.contributions[i],r.input[i]*r.weights[i]);
   }
   close(r.contributions.reduce((a,b)=>a+b,0),r.weightedSum);
   assert.equal(r.activationKind,layer===n.layers.length-1?'softmax':activation);
  }
 }
});
test('softmax explanation is stable and depends on all ten logits, not only the inspected neuron',()=>{
 const {n,p}=fixture();n.layers[1].b.fill(1000);n.layers[1].b[7]=1000.25;
 let r=inspectNeuron(n,p,1,7);close(r.softmax.numerator/r.softmax.denominator,r.activation);
 assert.ok([r.softmax.maximum,r.softmax.numerator,r.softmax.denominator,r.activation].every(Number.isFinite));
 const before=r.activation,z=r.z;n.layers[1].b[4]+=10;r=inspectNeuron(n,p,1,7);
 assert.equal(r.z,z);assert.ok(r.activation<before);close(r.softmax.numerator/r.softmax.denominator,r.activation);assert.equal(r.softmax.logits.length,10);
});
test('inspection follows trained/restored weights and current sample without mutating either',()=>{
 const {n,p}=fixture(),before=n.serialize(),copy=[...p],old=inspectNeuron(n,p,1,7);
 assert.deepEqual(n.serialize(),before);assert.deepEqual(p,copy);
 n.trainBatch([{pixels:p,label:7}],.1);const after=inspectNeuron(n,p,1,7);
 assert.notDeepEqual(after.weights,old.weights);assert.notEqual(after.bias,old.bias);
 const restored=Network.restore(n.serialize()),again=inspectNeuron(restored,p,1,7);
 assert.deepEqual(again,after);p[0]=0;p[1]=0;const newImage=inspectNeuron(restored,p,1,7);
 assert.notDeepEqual(newImage.input,again.input);assert.deepEqual(newImage.weights,again.weights);
});
test('every map cell keeps its index; padding and off-canvas clicks are not connections',()=>{
 for(const length of [1,2,3,5,32,64,128,256]){
  const grid=incomingGrid(length,length===256);
  for(let i=0;i<length;i++)assert.equal(connectionAt(grid,((i%grid.columns)+.5)/grid.columns,(Math.floor(i/grid.columns)+.5)/grid.rows),i);
  for(let i=length;i<grid.columns*grid.rows;i++)assert.equal(connectionAt(grid,((i%grid.columns)+.5)/grid.columns,(Math.floor(i/grid.columns)+.5)/grid.rows),null);
  for(const point of [[1,0],[-.1,0],[0,1],[NaN,0]])assert.equal(connectionAt(grid,...point),null);
 }
});
test('selection clamps safely after layer/model changes; tiny signed values remain legible',()=>{
 const {n}=fixture();assert.deepEqual(neuronSelection(n,8,99),{layer:1,neuron:9});assert.deepEqual(neuronSelection(n,0,99),{layer:0,neuron:1});
 assert.equal(finiteIndex('',256),0);assert.equal(finiteIndex(NaN,32),0);assert.equal(finiteIndex(-4,32),0);assert.equal(finiteIndex(1.8,32),1);
 assert.equal(numberText(-1e-8),'-1.0000e-8');assert.equal(numberText(-0),'0.00000');assert.equal(numberText(1.25),'1.25000');
});

test('contribution image keeps signs, masks, zero weights and indices after centered preprocessing',()=>{
 const topology={...clone(PRESETS[0]),inputMode:'centered'};topology.mask[4]=0;
 const n=new Network(topology),p=Array(256).fill(0);
 n.layers[0].w.fill(0);n.layers[0].b.fill(0);n.layers[0].b[2]=7;
 const weights=[2,-3,-4,5,10,0];p[2]=255;p[3]=255;p[4]=255;p[5]=255;
 for(let i=0;i<weights.length;i++)n.layers[0].w[2*256+i]=weights[i];
 const r=inspectNeuron(n,p,0,2);
 assert.deepEqual(Array.from(r.contributions.slice(0,6)),[-2,3,-4,5,0,0]);
 assert.equal(r.contributionTotals.positive,8);assert.equal(r.contributionTotals.negative,-6);
 assert.equal(r.contributionTotals.zero,252);assert.equal(r.contributionBound,5);
 assert.equal(r.weightedSum,2);assert.equal(r.bias,7);assert.equal(r.z,9);
 assert.equal(r.masked[4],true);assert.equal(r.input[4],0);assert.equal(r.weights[4],10);assert.equal(r.contributions[4],0);
});
test('opposite hidden contributions cancel before bias; an all-zero image still has its independent bias',()=>{
 const {n,p}=fixture(),r=inspectNeuron(n,p,1,7);
 assert.deepEqual(Array.from(r.contributions),[2,-2]);assert.equal(r.contributionBound,2);
 assert.deepEqual(r.contributionTotals,{positive:2,negative:-2,zero:0});
 assert.equal(r.weightedSum,0);assert.equal(r.z,.25);
 n.layers[1].w.fill(0);const zeros=inspectNeuron(n,p,1,7);
 assert.deepEqual(Array.from(zeros.contributions),[0,0]);assert.equal(zeros.contributionBound,0);
 assert.deepEqual(zeros.contributionTotals,{positive:0,negative:0,zero:2});assert.equal(zeros.weightedSum,0);assert.equal(zeros.z,.25);
});
test('products and their sum follow changed samples, actual SGD updates and restored models',()=>{
 const {n,p}=fixture(),before=inspectNeuron(n,p,1,7),beforePixels=inspectNeuron(n,p,0,0);
 n.trainBatch([{pixels:p,label:7}],.1);const trained=inspectNeuron(n,p,1,7);
 assert.notDeepEqual(trained.contributions,before.contributions);
 close(trained.contributions.reduce((sum,c)=>sum+c,0)+trained.bias,trained.z);
 const restored=inspectNeuron(Network.restore(n.serialize()),p,1,7);
 assert.deepEqual(restored.contributions,trained.contributions);assert.deepEqual(restored.contributionTotals,trained.contributionTotals);
 const edited=Array(256).fill(0),empty=inspectNeuron(n,edited,0,0);
 assert.equal(empty.contributionBound,0);assert.equal(empty.contributionTotals.zero,256);
 assert.notDeepEqual(empty.contributions,beforePixels.contributions);
});
test('contribution colors distinguish positive, negative and exact zero even for tiny nonzero values',()=>{
 const fills=[],context={fillStyle:'',fillRect(x,y,w,h){fills.push({x,y,w,h,color:this.fillStyle});},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const canvas={width:0,height:0,getContext(){return context;}};
 drawInspectorMap(canvas,[1e-15,-1e-15,0],incomingGrid(3),0,[-1,1],[],true);
 const cells=fills.filter(f=>f.w===24&&f.h===24);
 assert.equal(canvas.width,48);assert.equal(canvas.height,48);assert.equal(cells[2].color,'#e0e3db');
 assert.notEqual(cells[0].color,cells[2].color);assert.notEqual(cells[1].color,cells[2].color);assert.notEqual(cells[0].color,cells[1].color);
 const positive=cells[0].color.match(/\d+/g).map(Number),negative=cells[1].color.match(/\d+/g).map(Number);
 assert.ok(positive[1]>positive[0]);assert.ok(negative[0]>negative[1]);
});
