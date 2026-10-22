import {inspectNeuron} from './network.js';
import {translateText as t} from '../../i18n/i18n.js';
const $=id=>document.getElementById(id),fmt=n=>Number(n).toFixed(5);
export function inspectionGrid(count){
 if(count===1)return{cols:1,rows:1,positions:[{x:0,y:0}]};
 const maps=count/9,columns=Math.min(2,maps);
 return{cols:columns*3,rows:Math.ceil(maps/columns)*3,positions:Array.from({length:count},(_,i)=>({x:Math.floor(i/9)%columns*3+i%3,y:Math.floor(Math.floor(i/9)/columns)*3+Math.floor(i%9/3)}))};
}
export function pixels(canvas,values,size,highlight=null,signed=false){
 const ctx=canvas.getContext('2d'),s=canvas.width/size;ctx.clearRect(0,0,canvas.width,canvas.height);
 for(let i=0;i<values.length;i++){
  const v=values[i];ctx.fillStyle=signed?(v>=0?`rgb(${25+80*v},${50+170*v},${48+110*v})`:`rgb(${25-210*v},${50-55*v},${48-35*v})`):`rgb(${18+Math.round(v*220)},${35+Math.round(v*202)},${32+Math.round(v*188)})`;
  ctx.fillRect(i%size*s,Math.floor(i/size)*s,s+.1,s+.1);
 }
 if(highlight!==null){ctx.strokeStyle='#ffad77';ctx.lineWidth=2;ctx.strokeRect(highlight%size*s+1,Math.floor(highlight/size)*s+1,s-2,s-2);}
}
export function stageName(network,i){if(i===0)return t('Imagen de entrada');if(network.task==='autoencoder'&&i===2)return t('Código interno');if(i===network.layers.length)return t('Imagen de salida');return network.layers[i-1].type==='up'?t('Ampliar ×2'):t('Convolución')+' '+i;}
export function layout(states){
 let offset=30;const layers=states.map((s,stage)=>{
  const cols=Math.min(2,s.c),rows=Math.ceil(s.c/cols),step=7,tileW=s.w*step+12,tileH=s.h*step+23,width=Math.max(170,cols*tileW),nodes=[];
  for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++)for(let c=0;c<s.c;c++)nodes.push({stage,index:(y*s.w+x)*s.c+c,x:offset+(c%cols)*tileW+x*step,y:75+Math.floor(c/cols)*tileH+y*step});
  const result={x:offset,width,height:75+rows*tileH,nodes};offset+=width+65;return result;
 });return{layers,width:offset,height:Math.max(300,...layers.map(l=>l.height))+20};
}
export class ImageNetworkViewer{
 constructor(){
  this.stage=1;this.index=0;this.cell=0;this.zoom=1;this.panel=$('network-panel');this.home=this.panel.parentElement;this.marker=document.createComment('inspector-home');this.panel.after(this.marker);
  $('expand-network').onclick=()=>{$('network-dialog').append(this.panel);$('network-dialog').showModal();this.fit();};
  $('close-network').onclick=()=>$('network-dialog').close();
  $('network-dialog').addEventListener('close',()=>{this.marker.before(this.panel);this.fit();});
  $('network-layer').onchange=()=>{this.stage=Number($('network-layer').value);this.index=0;this.cell=0;this.render();};
  $('network-neuron').oninput=()=>{this.index=Math.max(0,Math.min(this.trace.states[this.stage].data.length-1,Math.floor(Number($('network-neuron').value)||0)));this.cell=0;this.render();};
  $('network-all-edges').onchange=()=>this.draw();
  $('network-zoom-in').onclick=()=>this.setZoom(this.zoom*1.3);$('network-zoom-out').onclick=()=>this.setZoom(this.zoom/1.3);$('network-fit').onclick=()=>this.fit();$('network-center').onclick=()=>this.center();
  $('network-full-canvas').onclick=e=>{
   const canvas=$('network-full-canvas'),r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*canvas.width/r.width,y=(e.clientY-r.top)*canvas.height/r.height;
   const layer=this.world.layers.find(l=>x>=l.x-4&&x<l.x+l.width);if(!layer)return;
   const node=layer.nodes.find(n=>Math.abs(n.x-x)<=4&&Math.abs(n.y-y)<=4);if(node){this.stage=node.stage;this.index=node.index;this.cell=0;this.render();}
  };
  for(const id of ['inspection-inputs','inspection-weights','inspection-products'])$(id).onclick=e=>{
   const canvas=$(id),r=canvas.getBoundingClientRect(),grid=inspectionGrid(this.detail.entries.length),x=Math.floor((e.clientX-r.left)/r.width*grid.cols),y=Math.floor((e.clientY-r.top)/r.height*grid.rows),index=grid.positions.findIndex(p=>p.x===x&&p.y===y);
   if(index<0)return;this.cell=index;this.details();this.draw();
  };
  $('inspection-cell').oninput=()=>{this.cell=Math.max(0,Math.min(this.detail.entries.length-1,Math.floor(Number($('inspection-cell').value)||0)));this.details();this.draw();};
 }
 update(network,trace){this.network=network;this.trace=trace;this.world=layout(trace.states);this.render();if(!this.fitted){this.fit();this.fitted=true;}}
 setZoom(value){this.zoom=Math.max(.15,Math.min(4,value));const c=$('network-full-canvas');c.style.width=this.world.width*this.zoom+'px';c.style.height=this.world.height*this.zoom+'px';$('network-zoom').textContent=Math.round(this.zoom*100)+'%';}
 fit(){if(this.world){const v=$('network-viewport');this.setZoom(Math.min(1,(v.clientWidth-20)/this.world.width,(parseFloat(getComputedStyle(v).maxHeight)-10)/this.world.height));}}
 center(){if(!this.world)return;const v=$('network-viewport'),n=this.world.layers[this.stage].nodes[this.index];v.scrollLeft=n.x*this.zoom-v.clientWidth/2;v.scrollTop=n.y*this.zoom-v.clientHeight/2;}
 render(){
  if(!this.trace)return;
  const picker=$('network-layer'),labels=this.trace.states.map((s,i)=>`${i} · ${stageName(this.network,i)} · ${s.w}×${s.h}×${s.c} = ${s.data.length}`),signature=labels.join('|');
  if(this.optionSignature!==signature){picker.replaceChildren(...labels.map((text,i)=>{const o=document.createElement('option');o.value=i;o.textContent=text;return o;}));this.optionSignature=signature;}picker.value=this.stage;
  const s=this.trace.states[this.stage];$('network-neuron').max=s.data.length-1;$('network-neuron').value=this.index;
  $('network-count').textContent=this.trace.states.reduce((n,s)=>n+s.data.length,0)+' '+t('activaciones visibles, sin muestreo');
  this.details();this.draw();
 }
 details(){
  this.detail=inspectNeuron(this.network,this.trace,this.stage,this.index);const d=this.detail;
  $('inspection-title').textContent=stageName(this.network,this.stage)+` · (${d.x}, ${d.y}) · `+t('mapa')+' '+d.channel;
  $('inspection-description').textContent=t(d.kind==='input'?'Esta neurona contiene el valor de un píxel de entrada. No tiene pesos ni sesgo.':d.kind==='up'?'Esta operación copia una activación en un bloque de 2 × 2. No tiene parámetros aprendidos.':'Este filtro de 3 × 3 recorre todos los mapas de la capa anterior. Comparte sus pesos y su sesgo entre posiciones del mismo mapa de salida.');
  $('inspection-calculation').textContent=d.kind==='conv'?`${t('Suma de productos')} + ${t('sesgo')} = ${(d.sum-d.bias).toFixed(5)} + ${fmt(d.bias)} = ${fmt(d.sum)} → ${d.function} → ${fmt(d.calculated)}`+(d.overridden?' · '+t('Activación manual')+' = '+fmt(d.activation):''):t('Activación')+' = '+fmt(d.activation);
  $('inspection-grids').hidden=d.kind==='input';
  if(!d.entries.length){$('inspection-term').textContent='';return;}
  this.cell=Math.max(0,Math.min(this.cell,d.entries.length-1));$('inspection-cell').max=d.entries.length-1;$('inspection-cell').value=this.cell;
  const {cols,rows,positions}=inspectionGrid(d.entries.length);
  for(const [id,key,signed]of [['inspection-inputs','value',false],['inspection-weights','weight',true],['inspection-products','product',true]]){
   const canvas=$(id),c=canvas.getContext('2d');canvas.width=cols*30;canvas.height=rows*30;
   const bound=Math.max(.001,...d.entries.map(e=>Math.abs(e[key])));
   for(let i=0;i<d.entries.length;i++){
    const e=d.entries[i],v=e[key]/(signed?bound:1),p=positions[i];c.fillStyle=e.padded&&key!=='weight'?'#37403b':v<0?`rgb(${45-180*v},${55-65*v},${50-30*v})`:`rgb(${30+100*v},${55+155*v},${50+95*v})`;c.fillRect(p.x*30,p.y*30,29,29);
   }
   c.strokeStyle='#89a68c';c.lineWidth=1;for(let y=0;y<rows;y+=3)for(let x=0;x<cols;x+=3)c.strokeRect(x*30,y*30,90,90);
   c.strokeStyle='#ffb47e';c.lineWidth=3;c.strokeRect(positions[this.cell].x*30+1,positions[this.cell].y*30+1,27,27);
   canvas.style.height='auto';canvas.style.aspectRatio=cols+' / '+rows;
  }
  const e=d.entries[this.cell];$('inspection-term').textContent=`${t('Entrada')} (${e.x}, ${e.y}), ${t('mapa')} ${e.channel}: ${fmt(e.value)} × ${fmt(e.weight)} = ${fmt(e.product)}`+(e.padded?' · '+t('Fuera de la imagen: relleno con cero.'):'');
  $('inspection-grid-note').textContent=d.kind==='up'?t('El 1 representa una copia fija; no es un peso entrenable.'):t('Cada grupo de 9 celdas corresponde a un mapa de entrada. Entradas con signo: verde positivo, naranja negativo; gris para relleno. Pesos y productos usan escalas de color independientes; selecciona una celda para leer el valor exacto.');
 }
 draw(){
  const canvas=$('network-full-canvas'),world=this.world;if(!world)return;
  canvas.width=world.width;canvas.height=world.height;this.setZoom(this.zoom);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#142722';ctx.fillRect(0,0,canvas.width,canvas.height);
  // All actual edges can be shown; selected mode keeps the receptive field legible.
  const all=$('network-all-edges').checked;
  for(let stage=1;stage<this.trace.states.length;stage++){
   if(!all&&stage!==this.stage)continue;
   const indices=all?world.layers[stage].nodes.map(n=>n.index):[this.index];
   ctx.strokeStyle=all?'#8bb59a13':'#9ed7ae90';ctx.lineWidth=all?.5:1;
   ctx.beginPath();
   for(const index of indices){
    const detail=inspectNeuron(this.network,this.trace,stage,index),to=world.layers[stage].nodes[index];
    for(const e of detail.entries)if(e.inputIndex!==null){const from=world.layers[stage-1].nodes[e.inputIndex];ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);}
   }
   ctx.stroke();
  }
  for(let stage=0;stage<world.layers.length;stage++){
   const l=world.layers[stage],s=this.trace.states[stage];ctx.fillStyle='#d9e5d6';ctx.font='12px system-ui';ctx.fillText(stageName(this.network,stage),l.x,24);ctx.font='11px monospace';ctx.fillText(`${s.w} × ${s.h} × ${s.c} = ${s.data.length}`,l.x,44);
   for(let c=0;c<s.c;c++){const tile=l.nodes[c];ctx.fillStyle='#b4cbb6';ctx.font='9px monospace';ctx.fillText(t('mapa')+' '+c,tile.x,tile.y-8);}
   for(const n of l.nodes){const v=s.data[n.index];ctx.fillStyle=v<0?`rgb(${45-180*v},${55-60*v},${50-30*v})`:`rgb(${30+110*v},${60+160*v},${50+115*v})`;ctx.fillRect(n.x-2.5,n.y-2.5,5,5);}
  }
  const node=world.layers[this.stage].nodes[this.index];ctx.strokeStyle='#ffb47e';ctx.lineWidth=2;ctx.strokeRect(node.x-5,node.y-5,10,10);
  const e=this.detail?.entries[this.cell];if(e?.inputIndex!==null&&e?.inputIndex!==undefined&&this.stage>0){const from=world.layers[this.stage-1].nodes[e.inputIndex];ctx.strokeRect(from.x-5,from.y-5,10,10);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(node.x,node.y);ctx.stroke();}
 }
}
