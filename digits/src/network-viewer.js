import {drawNetwork,networkLayout} from './view.js';
import {getLanguage} from '../../i18n/i18n.js';
const $=id=>document.getElementById(id);

export class NetworkViewer{
 constructor(select){
  this.select=select;this.camera={full:true,scale:1,x:0,y:0};this.nodes=[];this.frame=null;this.drag=null;
  this.dialog=$('network-dialog');this.canvas=$('network-full-canvas');this.viewport=$('network-viewport');
  // Reuse the live inspector so its canvases, cell selection and controls stay synchronized.
  this.inspection=$('neuron-inspection');this.inspectionHome=this.inspection.parentElement;this.inspectionNext=this.inspection.nextSibling;
  $('expand-network').addEventListener('click',()=>{if(!this.network)return;$('network-inspector').append(this.inspection);this.dialog.showModal();this.resize();this.center();});
  $('network-zoom-in').addEventListener('click',()=>this.zoom(1.3));
  $('network-zoom-out').addEventListener('click',()=>this.zoom(1/1.3));
  $('network-fit').addEventListener('click',()=>this.fit());
  $('network-center').addEventListener('click',()=>this.center());
  $('network-full-layer').addEventListener('change',()=>{this.select(Number($('network-full-layer').value),0);this.center();});
  $('network-full-neuron').addEventListener('input',()=>{if($('network-full-neuron').value==='')return;this.select(Number($('network-full-layer').value),Number($('network-full-neuron').value));this.center();});
  this.canvas.addEventListener('pointerdown',e=>{
   if(e.button!==0||this.drag)return;e.preventDefault();this.canvas.focus();this.canvas.setPointerCapture(e.pointerId);
   this.drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:this.camera.x,y:this.camera.y,moved:false};
  });
  this.canvas.addEventListener('pointermove',e=>{
   const d=this.drag;if(!d||d.id!==e.pointerId)return;
   const dx=e.clientX-d.startX,dy=e.clientY-d.startY;d.moved ||= Math.hypot(dx,dy)>4;
   this.camera.x=d.x+dx;this.camera.y=d.y+dy;this.schedule();
  });
  this.canvas.addEventListener('pointerup',e=>{
   const d=this.drag;if(!d||d.id!==e.pointerId)return;this.drag=null;
   if(!d.moved){
    const r=this.canvas.getBoundingClientRect(),{x,y,scale}=this.camera,px=(e.clientX-r.left-x)/scale,py=(e.clientY-r.top-y)/scale;
    const n=this.nodes.find(n=>Math.hypot(n.x-px,n.y-py)<Math.max(10,12/scale));if(n)this.select(n.layer,n.i);
   }
  });
  for(const type of ['pointercancel','lostpointercapture'])this.canvas.addEventListener(type,()=>{this.drag=null;});
  this.canvas.addEventListener('wheel',e=>{e.preventDefault();const factor=e.deltaMode===1?20:e.deltaMode===2?this.canvas.height:1;this.camera.x-=e.deltaX*factor;this.camera.y-=e.deltaY*factor;this.schedule();},{passive:false});
  this.canvas.addEventListener('keydown',e=>{
   const steps={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]};
   if(steps[e.key]){e.preventDefault();this.camera.x+=steps[e.key][0];this.camera.y+=steps[e.key][1];this.schedule();}
   else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')this.center();else this.zoom(e.key==='-'?1/1.3:1.3);}
  });
  this.dialog.addEventListener('close',()=>{this.inspectionHome.insertBefore(this.inspection,this.inspectionNext);this.drag=null;cancelAnimationFrame(this.frame);this.frame=null;});
  new ResizeObserver(()=>{if(this.dialog.open)this.resize();}).observe(this.viewport);
 }
 update(network,trace,selected){
  const changed=this.network?.sizes.join(',')!==network.sizes.join(',');this.network=network;this.trace=trace;this.selected=selected;
  $('expand-network').disabled=false;
  if(!this.dialog.open)return;
  if(changed)this.center();else this.schedule();
 }
 resize(){
  const width=Math.max(1,Math.round(this.viewport.clientWidth)),height=Math.max(1,Math.round(this.viewport.clientHeight));
  if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
  this.schedule();
 }
 schedule(){if(this.frame===null)this.frame=requestAnimationFrame(()=>{this.frame=null;if(this.dialog.open)this.render();});}
 zoom(factor){
  const c=this.camera,scale=Math.max(.04,Math.min(2.5,c.scale*factor)),ratio=scale/c.scale;
  c.x=this.canvas.width/2-(this.canvas.width/2-c.x)*ratio;c.y=this.canvas.height/2-(this.canvas.height/2-c.y)*ratio;c.scale=scale;this.schedule();
 }
 fit(){
  const layout=networkLayout(this.network,{full:true}),c=this.camera;c.scale=Math.min(1,(this.canvas.width-24)/layout.width,(this.canvas.height-24)/layout.height);
  c.x=(this.canvas.width-layout.width*c.scale)/2;c.y=(this.canvas.height-layout.height*c.scale)/2;this.schedule();
 }
 center(){
  if(!this.network)return;
  const layout=networkLayout(this.network,{full:true}),n=layout.nodes[this.selected.layer+1][this.selected.neuron],c=this.camera;
  c.scale=1;c.x=this.canvas.width/2-n.x;c.y=Math.min(0,this.canvas.height/2-n.y);this.schedule();
 }
 render(){
  const {network,trace,selected}=this,en=getLanguage()==='en',layer=network.layers[selected.layer];
  this.nodes=drawNetwork(this.canvas,network,trace,selected,true,this.camera);
  $('network-full-shape').textContent=network.topology.name+' · '+network.sizes.join(' → ');
  $('network-zoom').textContent=Math.round(this.camera.scale*100)+'%';
  $('network-zoom-out').disabled=this.camera.scale<=.04;$('network-zoom-in').disabled=this.camera.scale>=2.5;
  const picker=$('network-full-layer');
  const options=network.layers.map((l,i)=>`<option value="${i}">${i===network.layers.length-1?(en?'Output':'Salida'):(en?'Hidden ':'Oculta ')+(i+1)} · ${l.b.length}</option>`).join('');
  if(picker.innerHTML!==options)picker.innerHTML=options;picker.value=selected.layer;
  $('network-full-neuron').max=layer.b.length-1;$('network-full-neuron').value=selected.neuron;
  $('network-full-detail').textContent=(en?'Selected neuron: layer ':'Neurona seleccionada: capa ')+(selected.layer+1)+' · '+selected.neuron+' · z = '+trace.z[selected.layer][selected.neuron].toFixed(5)+(en?' · activation = ':' · activación = ')+trace.a[selected.layer+1][selected.neuron].toFixed(5);
 }
}
