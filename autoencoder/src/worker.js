import {LOW_SIZE,createNetwork,restore,snapshot,forward,mse,trainBatch,random} from './network.js';
import {dataset,resize} from './data.js';
let network,train,validation,history=[],epoch=0,cursor=0,order=[],running=false,remaining=0,timer=null;
function evaluate(){
 let loss=0,baseline=0;
 for(const s of validation){loss+=mse(forward(network,s.input).output,s.target);if(network.task==='superresolution')baseline+=mse(resize(s.input,LOW_SIZE),s.target);}
 return{epoch,validation:loss/validation.length,baseline:network.task==='superresolution'?baseline/validation.length:null};
}
function report(kind='progress'){postMessage({kind,model:snapshot(network),epoch,batch:cursor,total:train.length,history,running});}
function stop(){running=false;clearTimeout(timer);timer=null;}
function tick(){
 if(!running)return;
 try{
  if(cursor===0){order=Array.from({length:train.length},(_,i)=>i);const rng=random(430+epoch);for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}}
  trainBatch(network,order.slice(cursor,cursor+8).map(i=>train[i]));cursor+=8;
  if(cursor>=train.length){cursor=0;epoch++;remaining--;history.push(evaluate());if(history.length>201)history.splice(1,1);if(remaining<=0)stop();report();}
  if(running)timer=setTimeout(tick,0);
 }catch(error){stop();postMessage({kind:'error',message:error.message});}
}
globalThis.onmessage=({data})=>{
 try{
  if(data.kind==='init'){
   stop();network=data.model?restore(data.model,data.task):createNetwork(data.task);train=dataset(data.task);validation=dataset(data.task,'validation');epoch=0;cursor=0;history=[evaluate()];report('ready');
  }else if(data.kind==='train'&&network&&!running){remaining=Math.max(1,Math.min(100,Math.floor(Number(data.epochs)||1)));running=true;report();timer=setTimeout(tick,0);}
  else if(data.kind==='pause'&&network){stop();report();}
 }catch(error){stop();postMessage({kind:'error',message:error.message});}
};
