import { getLocale } from '../i18n/i18n.js';
import {NAND,XOR,score,hard,accuracy,boundarySegment,dialValue,dialAngle,dialDragValue,dialKeyValue,XOR_PARAMETER_KEYS,XOR_CHALLENGE,XOR_SOLUTION,xorHiddenModels,manualXor} from './math.js';
const $=id=>document.getElementById(id),number=id=>Number($(id).value),fmt=(n,d=2)=>Number(n).toFixed(d);
const state={lesson:1,point:1,networkMode:'RETO MANUAL',highlight:null};
const parameters={'weight-1':-1,'weight-2':-1,bias:1.5,...Object.fromEntries(XOR_PARAMETER_KEYS.map(key=>['xor-'+key,XOR_CHALLENGE[key]]))};
const decisionModel=()=>({weights:[parameters['weight-1'],parameters['weight-2']],bias:parameters.bias});
const networkParameters=()=>Object.fromEntries(XOR_PARAMETER_KEYS.map(key=>[key,parameters['xor-'+key]]));
function renderDials(){
 Object.entries(parameters).forEach(([id,value])=>{
  const dial=$(id+'-dial');dial.style.setProperty('--dial-angle',dialAngle(value)+'deg');dial.setAttribute('aria-valuenow',String(value));
  dial.setAttribute('aria-valuetext',value.toLocaleString(getLocale(),{minimumFractionDigits:1})+'. '+$(id+'-help').textContent);
  if(document.activeElement!==$(id))$(id).value=fmt(value,1);
 });
}
function canvasContext(id){
 const canvas=$(id);const width=canvas.clientWidth;if(!width)return null;
 const height=width/(4/3),ratio=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
 const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
 return {ctx,width,height};
}
function plot(id,samples,classifier,{models=[],probe=null}={}){
 const result=canvasContext(id);if(!result)return;
 const {ctx,width,height}=result,left=38,top=15,right=18,bottom=33,plotW=width-left-right,plotH=height-top-bottom,lo=-.2,hi=1.2;
 const X=x=>left+(x-lo)/(hi-lo)*plotW,Y=y=>top+(hi-y)/(hi-lo)*plotH;
 ctx.fillStyle='#fcfcf8';ctx.fillRect(0,0,width,height);
 const paleZero=[242,219,204],paleOne=[207,225,194];
 for(let px=0;px<plotW;px+=5)for(let py=0;py<plotH;py+=5){
   const x=lo+(px+2.5)/plotW*(hi-lo),y=hi-(py+2.5)/plotH*(hi-lo);
   const p=classifier([x,y]);
   ctx.fillStyle='rgb('+paleZero.map((v,i)=>Math.round(v+(paleOne[i]-v)*p)).join(',')+')';
   ctx.fillRect(left+px,top+py,Math.min(5,plotW-px),Math.min(5,plotH-py));
 }
 ctx.font='10px Consolas,monospace';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const t of [0,.5,1]){
   ctx.strokeStyle='#82947735';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(X(t),top);ctx.lineTo(X(t),top+plotH);ctx.moveTo(left,Y(t));ctx.lineTo(left+plotW,Y(t));ctx.stroke();
   ctx.fillStyle='#75846a';ctx.fillText(String(t),X(t),height-17);ctx.fillText(String(t),left-18,Y(t));
 }
 ctx.strokeStyle='#aebba1';ctx.strokeRect(left,top,plotW,plotH);
 ctx.fillStyle='#556b4b';ctx.fillText('x₁',width-10,height-16);ctx.fillText('x₂',20,8);
 models.forEach((model,i)=>{
   const line=boundarySegment(model,lo,hi);if(!line.length)return;
   ctx.strokeStyle=i?'#977059':'#354b3f';ctx.lineWidth=2;ctx.setLineDash(models.length>1?[7,4]:[]);
   ctx.beginPath();ctx.moveTo(X(line[0][0]),Y(line[0][1]));ctx.lineTo(X(line[1][0]),Y(line[1][1]));ctx.stroke();ctx.setLineDash([]);
 });
 samples.forEach(s=>{
   const x=X(s.x[0]),y=Y(s.x[1]),wrong=classifier(s.x)!==s.y;
   if(wrong){ctx.strokeStyle='#bd6646';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.stroke();}
   ctx.fillStyle=s.y?'#456b45':'#b57453';ctx.strokeStyle='#fffef8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.font='bold 11px Consolas,monospace';ctx.fillStyle='#fff';ctx.fillText(String(s.y),x,y+.5);
 });
 if(probe){
   const x=X(probe[0]),y=Y(probe[1]);ctx.strokeStyle='#233f36';ctx.lineWidth=2;ctx.fillStyle='#f9f8dd';ctx.beginPath();ctx.moveTo(x,y-9);ctx.lineTo(x+9,y);ctx.lineTo(x,y+9);ctx.lineTo(x-9,y);ctx.closePath();ctx.fill();ctx.stroke();
 }
}
function rows(id,samples,classifier,selected=-1){
 $(id).innerHTML=samples.map((s,i)=>{const p=classifier(s.x),ok=p===s.y;return '<tr'+(selected===i?' class="selected"':'')+'><td>('+s.x.join(', ')+')</td><td>'+s.y+'</td><td class="'+(ok?'correct':'incorrect')+'">'+p+' · '+(ok?'bien':'revisar')+'</td></tr>';}).join('');
}
function renderDecision(){
 renderDials();
 const model=decisionModel(),probe=[number('probe-1'),number('probe-2')];
 ['probe-1','probe-2'].forEach(id=>$(id+'-value').textContent=fmt(number(id)));
 const term=(n,label,first=false)=>(first?(n<0?'−':''):(n<0?' − ':' + '))+fmt(Math.abs(n),1)+label;
 $('boundary-equation').textContent='z = '+term(model.weights[0],' × x₁',true)+term(model.weights[1],' × x₂')+term(model.bias,'');
 const z=score(model,probe),output=hard(z);
 $('signal-x1').textContent=fmt(probe[0]);$('signal-x2').textContent=fmt(probe[1]);
 $('contribution-one').textContent='w₁ × x₁ = '+fmt(model.weights[0]*probe[0]);
 $('contribution-two').textContent='w₂ × x₂ = '+fmt(model.weights[1]*probe[1]);
 $('contribution-bias').textContent='b × 1 = '+fmt(model.bias);
 $('diagram-sum').textContent=fmt(z);$('diagram-output').textContent=String(output);
 $('diagram-output').parentElement.dataset.output=String(output);
 $('diagram-activation').textContent=z>=0?'z ≥ 0':'z < 0';
 $('point-equation').textContent=term(model.weights[0],' × '+fmt(probe[0]),true)+term(model.weights[1],' × '+fmt(probe[1]))+term(model.bias,'')+' = '+fmt(z);
 $('decision-status').textContent='La suma es '+fmt(z)+'. '+(z===0?'Está justo en el umbral: usamos z ≥ 0, así que la salida es 1.':'Como '+(z>=0?'z ≥ 0':'z < 0')+', la salida es '+output+'.');
 const [w1,w2]=model.weights;
 $('boundary-note').textContent=w1===0&&w2===0?(model.bias===0?'Todos los puntos tienen z = 0 y dan 1. No hay una única recta que separe respuestas.':'Con ambos pesos a cero, todas las entradas dan '+output+'. Solo decide b; no hay frontera.'):
 !boundarySegment(model).length?'La frontera queda fuera de esta ventana; aquí todos los puntos tienen la misma respuesta.':
 w2===0?'w₂ = 0: x₂ no influye. La frontera es vertical.':w1===0?'w₁ = 0: x₁ no influye. La frontera es horizontal.':'En la frontera, z = 0 y la salida es 1.';
 $('probe-sum').textContent='z = '+fmt(z);$('probe-output').textContent=output;
 const classifier=x=>hard(score(model,x));$('nand-score').textContent=accuracy(classifier,NAND)+' / 4';
 rows('nand-rows',NAND,classifier);plot('boundary-canvas',NAND,classifier,{models:[model],probe});
}
function highlightNetwork(){
 const active=state.highlight;
 document.querySelectorAll('.xor-network-svg').forEach(svg=>svg.classList.toggle('has-selected',!!active));
 document.querySelectorAll('[data-xor-ref]').forEach(el=>el.classList.toggle('is-highlight',el.dataset.xorRef===active?.key));
 document.querySelectorAll('[data-xor-node]').forEach(el=>el.classList.toggle('is-highlight',el.dataset.xorNode===active?.node));
 document.querySelectorAll('[data-network-key]').forEach(el=>el.classList.toggle('is-selected',el.dataset.networkKey===active?.key));
 $('network-focus-status').textContent=active?$('xor-'+active.key+'-label').firstChild.textContent+': '+$('xor-'+active.key+'-help').textContent:'Selecciona una rueda de abajo para resaltar la conexión o el sesgo que controla.';
}
function renderXor(){
 renderDials();
 const p=networkParameters(),sample=XOR[state.point],r=manualXor(p,sample.x),hiddenModels=xorHiddenModels(p),classifier=x=>manualXor(p,x).output;
 $('xor-mode-label').textContent=state.networkMode;
 const readouts={x1:String(sample.x[0]),x2:String(sample.x[1]),'h1-z':'z = '+fmt(r.hiddenScores[0]),'h2-z':'z = '+fmt(r.hiddenScores[1]),'out-z':'z = '+fmt(r.outputScore),'h1-a':'a = '+r.hidden[0],'h2-a':'a = '+r.hidden[1],'out-a':'y = '+r.output};
 document.querySelectorAll('[data-xor-readout]').forEach(el=>el.textContent=readouts[el.dataset.xorReadout]);
 document.querySelectorAll('[data-xor-value]').forEach(el=>{const key=el.dataset.xorValue,symbol=$('xor-'+key+'-label').querySelector('span').textContent;el.textContent=symbol+' '+fmt(p[key],1);});
 document.querySelectorAll('[data-xor-node]').forEach(el=>el.dataset.active=String(el.dataset.xorNode==='h1'?r.hidden[0]:el.dataset.xorNode==='h2'?r.hidden[1]:r.output));
 document.querySelectorAll('.xor-network-svg').forEach(svg=>svg.setAttribute('aria-label','Red 2 a 2 a 1. Entrada '+sample.x.join(', ')+'. h₁: suma '+fmt(r.hiddenScores[0])+', activación '+r.hidden[0]+'. h₂: suma '+fmt(r.hiddenScores[1])+', activación '+r.hidden[1]+'. Salida: suma '+fmt(r.outputScore)+', respuesta '+r.output+'.'));
 const term=(n,x,first=false)=>(first?(n<0?'−':''):(n<0?' − ':' + '))+fmt(Math.abs(n),1)+(x===null?'':' × '+x);
 const equation=(weights,bias,x)=>term(weights[0],x[0],true)+term(weights[1],x[1])+term(bias,null);
 for(let i=0;i<2;i++)$('calculation-h'+(i+1)).textContent='z'+(i+1)+' = '+equation(hiddenModels[i].weights,hiddenModels[i].bias,sample.x)+' = '+fmt(r.hiddenScores[i])+' → a'+(i+1)+' = '+r.hidden[i];
 $('calculation-out').textContent='zₒ = '+equation([p.v1,p.v2],p.bo,r.hidden)+' = '+fmt(r.outputScore)+' → y = '+r.output;
 $('xor-score').textContent=accuracy(classifier,XOR)+' de 4 correctos';
 rows('xor-rows',XOR,classifier,state.point);plot('xor-canvas',XOR,classifier,{models:hiddenModels,probe:sample.x});
 document.querySelectorAll('[data-xor-point]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.xorPoint)===state.point)));
 $('xor-inspection').textContent='Ejemplo ('+sample.x.join(', ')+'): activaciones ['+r.hidden.join(', ')+']. La salida suma '+fmt(r.outputScore)+' y responde '+r.output+'. Esperado: '+sample.y+'.';
 highlightNetwork();
}
function render(){if(state.lesson===1)renderDecision();else renderXor();}
const hashes=['#decidir','#combinar'];
function showLesson(n,interacted=true){
 state.lesson=n;document.querySelectorAll('.lesson').forEach((section,i)=>section.hidden=i!==n-1);
 document.querySelectorAll('.lesson-tabs button').forEach(button=>{if(Number(button.dataset.lesson)===n)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
 render();
 if(interacted){history.replaceState(null,'',hashes[n-1]);$('title-'+n).focus({preventScroll:true});document.querySelector('.lesson-tabs').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
}
document.querySelectorAll('[data-lesson]').forEach(button=>button.addEventListener('click',()=>showLesson(Number(button.dataset.lesson))));
function setParameter(id,raw,{keepInput=false}={}){
 const next=dialValue(raw);if(next===null)return false;
 parameters[id]=next;
 if(id.startsWith('xor-'))state.networkMode='AJUSTE MANUAL';
 if(!keepInput)$(id).value=fmt(next,1);
 $(id).removeAttribute('aria-invalid');render();return true;
}
Object.keys(parameters).forEach(id=>{
 const dial=$(id+'-dial'),input=$(id);let drag=null;
 dial.addEventListener('keydown',event=>{
   const next=dialKeyValue(parameters[id],event.key);
   if(next!==null){event.preventDefault();setParameter(id,next);}
 });
 dial.addEventListener('pointerdown',event=>{
   if(!event.isPrimary||event.button!==0)return;
   event.preventDefault();dial.focus({preventScroll:true});
   drag={id:event.pointerId,value:parameters[id],y:event.clientY};
   dial.setPointerCapture(event.pointerId);dial.classList.add('dragging');
 });
 dial.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   event.preventDefault();setParameter(id,dialDragValue(drag.value,drag.y,event.clientY));
 });
 const finish=event=>{
   if(!drag||event.pointerId!==drag.id)return;
   drag=null;dial.classList.remove('dragging');
   if(dial.hasPointerCapture(event.pointerId))dial.releasePointerCapture(event.pointerId);
 };
 ['pointerup','pointercancel','lostpointercapture'].forEach(name=>dial.addEventListener(name,finish));
 input.addEventListener('input',()=>{
   if(input.value!==''&&input.validity.valid)setParameter(id,input.value,{keepInput:true});
   else input.setAttribute('aria-invalid','true');
 });
 const commit=()=>{
   if(!setParameter(id,input.value)){input.value=fmt(parameters[id],1);input.removeAttribute('aria-invalid');}
 };
 input.addEventListener('change',commit);input.addEventListener('blur',commit);
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit();}});
});
document.querySelectorAll('[data-dial-step]').forEach(button=>button.addEventListener('click',()=>setParameter(button.dataset.for,parameters[button.dataset.for]+Number(button.dataset.dialStep)*.1)));
['probe-1','probe-2'].forEach(id=>$(id).addEventListener('input',renderDecision));
$('restore-nand').addEventListener('click',()=>{
 Object.assign(parameters,{'weight-1':-1,'weight-2':-1,bias:1.5});
 Object.entries(parameters).forEach(([id,value])=>{$(id).value=fmt(value,1);$(id).removeAttribute('aria-invalid');});
 renderDecision();
});
document.querySelectorAll('[data-network-key]').forEach(control=>{
 control.addEventListener('focusin',()=>{state.highlight={key:control.dataset.networkKey,node:control.dataset.networkNode};highlightNetwork();});
 control.addEventListener('focusout',event=>{if(!control.contains(event.relatedTarget)){state.highlight=null;highlightNetwork();}});
});
function loadNetwork(values,label){
 XOR_PARAMETER_KEYS.forEach(key=>{const id='xor-'+key;parameters[id]=values[key];$(id).value=fmt(values[key],1);$(id).removeAttribute('aria-invalid');});
 state.networkMode=label;renderXor();
}
$('xor-reset').addEventListener('click',()=>loadNetwork(XOR_CHALLENGE,'RETO MANUAL'));
$('xor-solution').addEventListener('click',()=>loadNetwork(XOR_SOLUTION,'EJEMPLO RESUELTO · CARGADO A MANO'));
document.querySelectorAll('[data-xor-point]').forEach(button=>button.addEventListener('click',()=>{state.point=Number(button.dataset.xorPoint);renderXor();}));
new ResizeObserver(render).observe(document.querySelector('main'));
window.addEventListener('hashchange',()=>{const n=hashes.indexOf(location.hash);if(n>=0)showLesson(n+1,false);});
showLesson(Math.max(0,hashes.indexOf(location.hash))+1,false);

document.addEventListener('languagechange', render);
