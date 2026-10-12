import {clone,validateTopology} from './model.js';
export class History{
 constructor(value){this.items=[clone(value)];this.cursor=0;}
 get value(){return clone(this.items[this.cursor]);}
 push(value){const next=clone(value);if(JSON.stringify(this.value)===JSON.stringify(next))return;this.items=this.items.slice(0,this.cursor+1);this.items.push(next);if(this.items.length>60)this.items.shift();this.cursor=this.items.length-1;}
 undo(){if(this.cursor>0)this.cursor--;return this.value;}
 redo(){if(this.cursor<this.items.length-1)this.cursor++;return this.value;}
}
export function translate(pixels,dx,dy){const result=Array(256).fill(0);for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(x+dx>=0&&x+dx<16&&y+dy>=0&&y+dy<16)result[(y+dy)*16+x+dx]=pixels[y*16+x];return result;}
export function center(pixels){let sum=0,x=0,y=0;pixels.forEach((v,i)=>{sum+=v;x+=(i%16)*v;y+=Math.floor(i/16)*v;});return sum?translate(pixels,Math.round(7.5-x/sum),Math.round(7.5-y/sum)):Array.from(pixels);}
export function stroke(pixels,x0,y0,x1,y1,value,radius=.7){const length=Math.hypot(x1-x0,y1-y0),steps=Math.max(1,Math.ceil(length*4));for(let s=0;s<=steps;s++){const x=x0+(x1-x0)*s/steps,y=y0+(y1-y0)*s/steps;for(let py=Math.max(0,Math.floor(y-radius-1));py<Math.min(16,Math.ceil(y+radius+1));py++)for(let px=Math.max(0,Math.floor(x-radius-1));px<Math.min(16,Math.ceil(x+radius+1));px++){const coverage=Math.max(0,Math.min(1,radius+.5-Math.hypot(px+.5-x,py+.5-y)));const i=py*16+px;if(value===0)pixels[i]=Math.round(pixels[i]*(1-coverage));else pixels[i]=Math.max(pixels[i],Math.round(value*coverage));}}return pixels;}
export function validateLibrary(types,selected){if(!Array.isArray(types)||!types.length||types.length>24)throw Error('Usa entre 1 y 24 tipos.');const ids=new Set();for(const t of types){validateTopology(t);if(ids.has(t.id))throw Error('Identidad de tipo repetida.');ids.add(t.id);}if(!Array.isArray(selected)||!selected.length||selected.length>8||new Set(selected).size!==selected.length||selected.some(id=>!ids.has(id)))throw Error('Asigna entre 1 y 8 tipos distintos a la comparación.');}
export function saveJSON(storage,key,value){if(!storage)throw Error('El navegador bloquea el guardado. Exporta un archivo JSON.');try{storage.setItem(key,JSON.stringify(value));}catch{throw Error('No hay espacio o permiso de guardado. Exporta un archivo JSON; el borrador se conserva.');}}
