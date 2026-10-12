import {loadManifest,experimentData,loadSplit,validateCustom} from './data.js';
import {Experiment} from './experiment.js';
let experiment,data,manifest,running=false,scheduled=false,loading=false,lastPost=0;
const snapshot=(state='paused')=>postMessage({type:'snapshot',state,experiment:experiment.serialize()});
function schedule(){if(scheduled)return;scheduled=true;setTimeout(tick,0);}
function tick(){scheduled=false;if(!running||!experiment)return;try{const start=performance.now();do{experiment.step(data);}while(!experiment.complete()&&performance.now()-start<24);if(performance.now()-lastPost>180||experiment.complete()){snapshot(experiment.complete()?'complete':'running');lastPost=performance.now();}if(experiment.complete())running=false;else schedule();}catch(e){running=false;postMessage({type:'error',message:e.message});}}
onmessage=async({data:msg})=>{try{if(loading)throw Error('Espera a que termine la carga.');if(msg.type==='init'||msg.type==='restore'){running=false;loading=true;manifest=await loadManifest();const custom=msg.type==='restore'?msg.experiment.custom:msg.custom;await validateCustom(custom,manifest);const nextData=await experimentData(manifest,custom);const next=msg.type==='init'?new Experiment(msg.types,msg.config,manifest.id,custom):Experiment.restore(msg.experiment,manifest.id,nextData.train.length);next.initialize(nextData);data=nextData;experiment=next;loading=false;snapshot(experiment.complete()?'complete':'paused');}
else if(msg.type==='run'){if(!experiment)throw Error('Prepara el experimento primero.');if(!experiment.complete()){running=true;schedule();}}
else if(msg.type==='pause'){running=false;snapshot(experiment.complete()?'complete':'paused');}
else if(msg.type==='step'){if(!experiment||running)throw Error('Pausa el experimento antes de avanzar.');experiment.step(data);snapshot(experiment.complete()?'complete':'paused');}
else if(msg.type==='final'){if(!experiment||!experiment.complete()||experiment.finalized)throw Error('El test solo se abre al completar un experimento.');loading=true;const test=await loadSplit(manifest,'test');experiment.finalEvaluation(test);loading=false;snapshot('finalized');}
}catch(e){loading=false;postMessage({type:'error',message:e.message});}};
