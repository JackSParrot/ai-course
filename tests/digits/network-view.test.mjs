import test from 'node:test';
import assert from 'node:assert/strict';
import {Network,PRESETS,clone,inputVector} from '../../digits/src/model.js';
import {networkLayout,drawNetwork} from '../../digits/src/view.js';

test('expanded layouts include every pixel and neuron, including maximum editable topologies',()=>{
 for(const topology of [...PRESETS,{...clone(PRESETS[1]),hidden:[128,128,128,128]}]){
  const net=new Network(topology),layout=networkLayout(net,{full:true});
  assert.deepEqual(layout.nodes.map(layer=>layer.length),net.sizes);
  for(const [index,layer] of layout.nodes.entries()){
   assert.deepEqual(layer.map(n=>n.i),Array.from({length:net.sizes[index]},(_,i)=>i));
   assert.ok(layer.every(n=>n.layer===index-1&&n.x>0&&n.x<layout.width&&n.y>0&&n.y<layout.height));
   assert.ok(layer.slice(1).every((n,i)=>n.y-layer[i].y>=32));
  }
 }
});
test('the compact diagram remains sampled while the expanded diagram exposes the missing neurons',()=>{
 const net=new Network(PRESETS[3]),compact=networkLayout(net),full=networkLayout(net,{full:true});
 assert.deepEqual(compact.nodes.map(layer=>layer.length),[8,8,10]);
 assert.deepEqual(full.nodes.map(layer=>layer.length),[256,128,10]);
 assert.equal(compact.nodes[1].at(-1).i,127);
});
test('the expanded renderer uses all real connections and returns every inspectable neuron',()=>{
 const net=new Network({...clone(PRESETS[1]),hidden:[3,2]}),trace=net.forward(inputVector(Array(256).fill(150),net.topology));
 let edges=0,depth=0;const ctx={clearRect(){},fillRect(){},save(){depth++;},restore(){depth--;},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){edges++;},stroke(){},arc(){},fill(){},fillText(){}};
 const canvas={width:1600,height:9000,getContext:()=>ctx};
 const nodes=drawNetwork(canvas,net,trace,{layer:0,neuron:2},true,{full:true,scale:1,x:0,y:0});
 assert.equal(edges,256*3+3*2+2*10);
 assert.equal(nodes.length,3+2+10);assert.equal(depth,0);
 for(let layer=0;layer<net.layers.length;layer++)assert.deepEqual(nodes.filter(n=>n.layer===layer).map(n=>n.i),Array.from({length:net.layers[layer].b.length},(_,i)=>i));
});
