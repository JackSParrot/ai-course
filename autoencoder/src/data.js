import {random} from './network.js';
// Procedural training data: no downloads, private photos, or overlapping held-out samples.
export function image(seed){
 const rng=random(seed),pixels=new Float32Array(576),count=1+Math.floor(rng()*3);
 for(let shape=0;shape<count;shape++){
  const type=Math.floor(rng()*4),cx=5+rng()*14,cy=5+rng()*14,r=2+rng()*5,brightness=.55+rng()*.45;
  const angle=rng()*Math.PI,dx=Math.cos(angle),dy=Math.sin(angle),solid=rng()<.4;
  for(let y=0;y<24;y++)for(let x=0;x<24;x++){
   let covered=0;
   // Four subpixel samples give anti-aliased edges without a browser canvas.
   for(const sy of [.25,.75])for(const sx of [.25,.75]){
    const a=x+sx-cx,b=y+sy-cy,dist=Math.hypot(a,b),box=Math.max(Math.abs(a),Math.abs(b));
    const hit=type===0?(solid?dist<r:Math.abs(dist-r)<.8):type===1?(solid?box<r:Math.abs(box-r)<.8):type===2?(Math.abs(-a*dy+b*dx)<.85&&Math.abs(a*dx+b*dy)<r*1.5):((Math.abs(a)<.8&&Math.abs(b)<r)||(Math.abs(b)<.8&&Math.abs(a)<r));
    if(hit)covered++;
   }
   pixels[y*24+x]=Math.max(pixels[y*24+x],brightness*covered/4);
  }
 }
 return pixels;
}
export function reduce(pixels){
 const out=new Float32Array(144);
 for(let y=0;y<12;y++)for(let x=0;x<12;x++)out[y*12+x]=(pixels[(2*y)*24+2*x]+pixels[(2*y)*24+2*x+1]+pixels[(2*y+1)*24+2*x]+pixels[(2*y+1)*24+2*x+1])/4;
 return out;
}
export function sample(task,seed){const target=image(seed);return{input:task==='autoencoder'?target:reduce(target),target};}
export function dataset(task,split='train'){
 const starts={train:1000,validation:100000,test:200000};if(!(split in starts))throw Error('Invalid split');
 return Array.from({length:split==='train'?128:24},(_,i)=>sample(task,starts[split]+i*7919));
}
export function resize(pixels,size,method='bilinear'){
 const out=new Float32Array(size*2*size*2),width=size*2;
 const get=(x,y)=>pixels[Math.max(0,Math.min(size-1,y))*size+Math.max(0,Math.min(size-1,x))];
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  if(method==='nearest'){out[y*width+x]=get(Math.floor(x/2),Math.floor(y/2));continue;}
  const sx=(x+.5)/2-.5,sy=(y+.5)/2-.5,ix=Math.floor(sx),iy=Math.floor(sy),a=sx-ix,b=sy-iy;
  out[y*width+x]=(1-a)*(1-b)*get(ix,iy)+a*(1-b)*get(ix+1,iy)+(1-a)*b*get(ix,iy+1)+a*b*get(ix+1,iy+1);
 }
 return out;
}
