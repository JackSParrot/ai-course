import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NAND,OR,XOR,score,hard,accuracy,boundarySegment,dialValue,dialAngle,dialDragValue,dialKeyValue,XOR_PARAMETER_KEYS,XOR_CHALLENGE,XOR_SOLUTION,xorHiddenModels,manualXor} from '../course/math.js';

test('NAND uses two weighted inputs and one additive bias',()=>{
 const model={weights:[-1,-1],bias:1.5};
 assert.deepEqual(NAND.map(s=>s.y),[1,1,1,0]);
 assert.deepEqual(NAND.map(s=>hard(score(model,s.x))),[1,1,1,0]);
 assert.equal(score(model,[1,0]),.5);
 assert.deepEqual(XOR.map(s=>s.y),[0,1,1,0]);
});
test('the same neuron can implement OR by changing only its weights and bias',()=>{
 const nand={weights:[-1,-1],bias:1.5},or={weights:[1,1],bias:-.5};
 assert.deepEqual(OR.map(({x,y})=>[...x,y]),[[0,0,0],[1,0,1],[0,1,1],[1,1,1]]);
 assert.equal(accuracy(x=>hard(score(nand,x)),NAND),4);
 assert.equal(accuracy(x=>hard(score(nand,x)),OR),2);
 assert.equal(accuracy(x=>hard(score(or,x)),OR),4);
 assert.equal(accuracy(x=>hard(score(or,x)),XOR),3);
});
test('boundaries remain finite for vertical, horizontal, missing and zero-weight cases',()=>{
 for(const model of [{weights:[-1,-1],bias:1.5},{weights:[2,0],bias:-1},{weights:[0,2],bias:-1}]){
  const segment=boundarySegment(model);assert.equal(segment.length,2);
  for(const point of segment){assert.ok(point.every(Number.isFinite));assert.ok(Math.abs(score(model,point))<1e-10);}
 }
 for(const bias of [-3,0,3]){
  const model={weights:[0,0],bias};assert.deepEqual(boundarySegment(model),[]);
  for(const {x} of NAND)assert.equal(hard(score(model,x)),bias>=0?1:0);
 }
 assert.deepEqual(boundarySegment({weights:[1,1],bias:100}),[]);
});
test('decimal cancellation obeys output one on z=0 without erasing negative small scores',()=>{
 for(const model of [{weights:[-.1,-.2],bias:.3},{weights:[-.7,-.1],bias:.8}]){
  assert.equal(score(model,[1,1]),0);assert.equal(hard(score(model,[1,1])),1);
 }
 assert.equal(hard(score({weights:[0,0],bias:-1e-20},[0,0])),0);
});
test('the same bounded control scale supports exact entry, keyboard and pointer drag',()=>{
 for(const bad of ['', ' ',undefined,null,NaN,Infinity,'abc'])assert.equal(dialValue(bad),null);
 assert.equal(dialValue('1.26'),1.3);assert.equal(dialValue(90),3);assert.equal(dialValue(-90),-3);
 assert.equal(dialAngle(-3),-135);assert.equal(dialAngle(0),0);assert.equal(dialAngle(3),135);
 for(const key of ['ArrowUp','ArrowRight'])assert.equal(dialKeyValue(-1,key),-.9);
 for(const key of ['ArrowDown','ArrowLeft'])assert.equal(dialKeyValue(-1,key),-1.1);
 assert.equal(dialKeyValue(0,'PageUp'),.5);assert.equal(dialKeyValue(0,'PageDown'),-.5);
 assert.equal(dialKeyValue(0,'Home'),-3);assert.equal(dialKeyValue(0,'End'),3);assert.equal(dialKeyValue(1,'Tab'),null);
 assert.equal(dialKeyValue(3,'ArrowUp'),3);assert.equal(dialKeyValue(-3,'ArrowDown'),-3);
 assert.equal(dialDragValue(-1,100,65),0);assert.equal(dialDragValue(-1,100,135),-2);
 assert.equal(dialDragValue(0,100,-10000),3);assert.equal(dialDragValue(0,100,10000),-3);
});
test('the manual challenge starts with equal hidden neurons and no learned weights',()=>{
 const before=structuredClone(XOR_CHALLENGE);
 assert.deepEqual(xorHiddenModels(XOR_CHALLENGE)[0],xorHiddenModels(XOR_CHALLENGE)[1]);
 assert.deepEqual(XOR.map(s=>manualXor(XOR_CHALLENGE,s.x).output),[0,1,1,1]);
 assert.equal(accuracy(x=>manualXor(XOR_CHALLENGE,x).output,XOR),3);
 assert.deepEqual(XOR_CHALLENGE,before);
});
test('the explicitly loaded solution forwards through all three neurons and solves XOR',()=>{
 const actual=XOR.map(s=>manualXor(XOR_SOLUTION,s.x));
 assert.deepEqual(actual.map(r=>r.hiddenScores),[[-.5,1.5],[.5,.5],[.5,.5],[1.5,-.5]]);
 assert.deepEqual(actual.map(r=>r.hidden),[[0,1],[1,1],[1,1],[1,0]]);
 assert.deepEqual(actual.map(r=>r.outputScore),[-.5,.5,.5,-.5]);
 assert.deepEqual(actual.map(r=>r.output),[0,1,1,0]);
});
test('each of the nine parameters changes exactly its intended affine sum',()=>{
 const x=[.8,.6],base=manualXor(XOR_SOLUTION,x),delta=.1;
 const cases=[['h1w1',0,x[0]],['h1w2',0,x[1]],['b1',0,1],['h2w1',1,x[0]],['h2w2',1,x[1]],['b2',1,1],['v1',2,base.hidden[0]],['v2',2,base.hidden[1]],['bo',2,1]];
 assert.equal(cases.length,9);
 for(const [key,target,input]of cases){
  const changed=manualXor({...XOR_SOLUTION,[key]:XOR_SOLUTION[key]+delta},x);
  const before=target===2?base.outputScore:base.hiddenScores[target],after=target===2?changed.outputScore:changed.hiddenScores[target];
  assert.ok(Math.abs(after-before-delta*input)<1e-12,key);
  if(target<2)assert.equal(changed.hiddenScores[1-target],base.hiddenScores[1-target],key);
  else assert.deepEqual(changed.hiddenScores,base.hiddenScores,key);
 }
 assert.equal(manualXor({...XOR_SOLUTION,h1w1:3},[0,1]).hiddenScores[0],manualXor(XOR_SOLUTION,[0,1]).hiddenScores[0]);
});
test('every parameter can change an XOR answer: no decorative or hidden controls',()=>{
 const baseline=XOR.map(s=>manualXor(XOR_SOLUTION,s.x).output);
 for(const key of XOR_PARAMETER_KEYS){
  const changed=[-3,0,3].some(value=>XOR.some((sample,index)=>manualXor({...XOR_SOLUTION,[key]:value},sample.x).output!==baseline[index]));
  assert.ok(changed,key+' must be capable of changing an answer');
 }
});
test('all combinations of zero and extreme parameters forward without NaN or inconsistent activation',()=>{
 const values=[-3,0,3],p={};
 for(let combination=0;combination<3**9;combination++){
  let index=combination;for(const key of XOR_PARAMETER_KEYS){p[key]=values[index%3];index=Math.floor(index/3);}
  for(const {x}of XOR){
   const r=manualXor(p,x);assert.ok([...r.hiddenScores,r.outputScore].every(Number.isFinite));
   assert.deepEqual(r.hidden,r.hiddenScores.map(hard));assert.equal(r.output,hard(r.outputScore));
  }
 }
 const zero=Object.fromEntries(XOR_PARAMETER_KEYS.map(key=>[key,0]));
 assert.deepEqual(manualXor(zero,[1,1]),{hiddenScores:[0,0],hidden:[1,1],outputScore:0,output:1});
 assert.equal(manualXor({...zero,bo:-.1},[1,1]).output,0);
});
test('a single affine threshold cannot solve the XOR truth table',()=>{
 let best=0;
 for(let a=-3;a<=3;a+=.5)for(let b=-3;b<=3;b+=.5)for(let bias=-3;bias<=3;bias+=.5)
  best=Math.max(best,accuracy(x=>hard(score({weights:[a,b],bias},x)),XOR));
 assert.equal(best,3);
 // XOR needs b<0, a1+a2+b<0, a1+b>=0 and a2+b>=0. The latter imply a1+a2+b>=-b>0.
});
test('diagrams and accessible dials expose shared NAND controls in both views and all nine XOR parameters',async()=>{
 const html=await readFile(new URL('../course/index.html',import.meta.url),'utf8');
 assert.ok(html.indexOf('id="biological-neuron"')<html.indexOf('id="mathematical-perceptron"'));
 assert.ok(html.indexOf('id="mathematical-perceptron"')<html.indexOf('id="interactive-title"'));
 assert.ok(html.indexOf('class="network-diagram-card"')<html.indexOf('id="network-controls-title"'));
 assert.equal([...html.matchAll(/class="rotary" role="slider"/g)].length,15);
 for(const id of ['weight-1','weight-2','bias','plot-weight-1','plot-weight-2','plot-bias',...XOR_PARAMETER_KEYS.map(key=>'xor-'+key)]){
  assert.ok(html.includes('id="'+id+'-dial"'),id);
  assert.ok(html.includes('id="'+id+'" type="number" min="-3" max="3" step="0.1"'),id);
  assert.equal([...html.matchAll(new RegExp('data-for="'+id+'"','g'))].length,2,id);
 }
 for(const key of XOR_PARAMETER_KEYS)assert.equal([...html.matchAll(new RegExp('data-xor-ref="'+key+'"','g'))].length,2,key);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
});
test('chapter one separates the introduction and four manual exercises before digit training',async()=>{
 const html=await readFile(new URL('../course/index.html',import.meta.url),'utf8'),js=await readFile(new URL('../course/lesson.js',import.meta.url),'utf8');
 assert.equal([...html.matchAll(/class="(?:intro )?lesson" aria-labelledby/g)].length,5);
 assert.doesNotMatch(html,/training-canvas|learning-rate|train-one|train-run|lesson-tab-5|Aprender del error/);
 assert.doesNotMatch(js,/trainStep|gradient|setInterval|initialLearner|#aprender/);
 assert.ok(html.includes('El entrenamiento empieza con los números.'));
 assert.ok(html.includes('href="../digits/"'));
 const landing=await readFile(new URL('../shell/index.html',import.meta.url),'utf8');assert.doesNotMatch(landing,/Mira bajar el error|Aprendizaje visible/);
});

test('gate introductions precede their controls and explain the correct NAND, OR and XOR targets',async()=>{
 const html=await readFile(new URL('../course/index.html',import.meta.url),'utf8');
 const tableRows=id=>{
  const body=html.match(new RegExp('<table id="'+id+'"[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>'))?.[1];
  assert.ok(body,id);
  return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(row=>[...row[1].matchAll(/<td[^>]*>(\d)<\/td>/g)].map(cell=>Number(cell[1])));
 };
 assert.deepEqual(tableRows('nand-goal-table'),NAND.map(({x,y})=>[...x,y]));
 assert.deepEqual(tableRows('or-goal-table'),OR.map(({x,y})=>[...x,y]));
 assert.deepEqual(tableRows('xor-goal-table'),XOR.map(({x,y})=>[...x,x.some(Boolean)?1:0,y]));
 assert.ok(html.indexOf('id="nand-intro-title"')<html.indexOf('class="perceptron-card"'));
 assert.ok(html.indexOf('id="xor-intro-title"')<html.indexOf('class="network-diagram-card"'));
 assert.ok(html.includes('Piensa en 0 como «no» y en 1 como «sí».'));
});
