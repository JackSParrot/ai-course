// Tiny convolutional networks, forward pass and backpropagation, without dependencies.
// Tensors are row-major: (y * width + x) * channels + channel.
export function random(seed=1){let s=seed>>>0;return()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export function tensor(w,h,c,data=new Float32Array(w*h*c)){return{w,h,c,data};}
function convolution(input,layer){
 const {stride,channels,activation,w,b}=layer,ow=Math.ceil(input.w/stride),oh=Math.ceil(input.h/stride),out=tensor(ow,oh,channels);
 for(let y=0;y<oh;y++)for(let x=0;x<ow;x++)for(let o=0;o<channels;o++){
  let sum=b[o];
  for(let ky=0;ky<3;ky++)for(let kx=0;kx<3;kx++){
   const iy=y*stride+ky-1,ix=x*stride+kx-1;if(iy<0||ix<0||iy>=input.h||ix>=input.w)continue;
   for(let c=0;c<input.c;c++)sum+=input.data[(iy*input.w+ix)*input.c+c]*w[((o*3+ky)*3+kx)*input.c+c];
  }
  out.data[(y*ow+x)*channels+o]=activation==='sigmoid'?1/(1+Math.exp(-sum)):Math.tanh(sum);
 }
 return out;
}
export function enlarge(input){
 const out=tensor(input.w*2,input.h*2,input.c);
 for(let y=0;y<out.h;y++)for(let x=0;x<out.w;x++)for(let c=0;c<input.c;c++)out.data[(y*out.w+x)*out.c+c]=input.data[(Math.floor(y/2)*input.w+Math.floor(x/2))*input.c+c];
 return out;
}
function backward(input,out,layer,gradient){
 const dx=new Float32Array(input.data.length);
 if(layer.type==='up'){
  for(let y=0;y<out.h;y++)for(let x=0;x<out.w;x++)for(let c=0;c<out.c;c++)dx[(Math.floor(y/2)*input.w+Math.floor(x/2))*out.c+c]+=gradient[(y*out.w+x)*out.c+c];
  return dx;
 }
 const {stride,channels,w,gw,gb,activation}=layer;
 for(let y=0;y<out.h;y++)for(let x=0;x<out.w;x++)for(let o=0;o<channels;o++){
  const index=(y*out.w+x)*channels+o,a=out.data[index],g=gradient[index]*(activation==='sigmoid'?a*(1-a):1-a*a);gb[o]+=g;
  for(let ky=0;ky<3;ky++)for(let kx=0;kx<3;kx++){
   const iy=y*stride+ky-1,ix=x*stride+kx-1;if(iy<0||ix<0||iy>=input.h||ix>=input.w)continue;
   for(let c=0;c<input.c;c++){
    const ii=(iy*input.w+ix)*input.c+c,wi=((o*3+ky)*3+kx)*input.c+c;
    gw[wi]+=input.data[ii]*g;dx[ii]+=w[wi]*g;
   }
  }
 }
 return dx;
}
export function createNetwork(task='autoencoder',seed=42){
 if(!['autoencoder','superresolution'].includes(task))throw Error('Unknown image task');
 const rng=random(seed),layers=[];
 const conv=(inputs,channels,stride,activation='tanh')=>{
  const w=Float32Array.from({length:channels*9*inputs},()=> (rng()*2-1)*Math.sqrt(6/(9*(inputs+channels))));
  layers.push({type:'conv',inputs,channels,stride,activation,w,b:new Float32Array(channels),gw:new Float32Array(w.length),gb:new Float32Array(channels),mw:new Float32Array(w.length),vw:new Float32Array(w.length),mb:new Float32Array(channels),vb:new Float32Array(channels)});
 };
 if(task==='autoencoder'){conv(1,4,2);conv(4,4,2);layers.push({type:'up'});conv(4,4,1);layers.push({type:'up'});conv(4,1,1,'sigmoid');}
 else{conv(1,8,1);layers.push({type:'up'});conv(8,1,1,'sigmoid');}
 return{task,layers,step:0};
}
export function forward(network,pixels,latentOverride=null){
 const size=network.task==='autoencoder'?24:12;
 if(pixels.length!==size*size)throw Error('Invalid image dimensions');
 const states=[tensor(size,size,1,Float32Array.from(pixels))];
 for(const [i,layer]of network.layers.entries()){
  const input=states.at(-1);let out=layer.type==='up'?enlarge(input):convolution(input,layer);
  if(network.task==='autoencoder'&&i===1&&latentOverride){if(latentOverride.length!==144)throw Error('Invalid latent code');out=tensor(6,6,4,Float32Array.from(latentOverride));}
  states.push(out);
 }
 return{output:states.at(-1).data,states,latent:network.task==='autoencoder'?states[2]:null,intervention:network.task==='autoencoder'&&latentOverride?{stage:2}:null};
}
export function decode(network,latent){
 if(network.task!=='autoencoder'||latent.length!==144)throw Error('Expected 6 × 6 × 4 activations');
 let input=tensor(6,6,4,Float32Array.from(latent));
 for(const layer of network.layers.slice(2))input=layer.type==='up'?enlarge(input):convolution(input,layer);
 return input.data;
}
export function mse(actual,target){if(actual.length!==target.length)throw Error('Mismatched images');let loss=0;for(let i=0;i<actual.length;i++)loss+=(actual[i]-target[i])**2;return loss/actual.length;}
export function gradients(network,input,target){
 const result=forward(network,input);if(target.length!==result.output.length)throw Error('Invalid target');
 let grad=Float32Array.from(result.output,(v,i)=>2*(v-target[i])/target.length);
 for(let i=network.layers.length-1;i>=0;i--)grad=backward(result.states[i],result.states[i+1],network.layers[i],grad);
 return mse(result.output,target);
}
export function clearGradients(network){for(const l of network.layers)if(l.type==='conv'){l.gw.fill(0);l.gb.fill(0);}}
export function trainBatch(network,samples,rate=.008){
 if(!samples.length)throw Error('Empty batch');clearGradients(network);let loss=0;
 for(const {input,target}of samples)loss+=gradients(network,input,target);
 network.step++;
 const a=1-.9**network.step,b=1-.999**network.step;
 for(const layer of network.layers)if(layer.type==='conv')for(const key of ['w','b']){
  const p=layer[key],g=layer['g'+key],m=layer['m'+key],v=layer['v'+key];
  for(let i=0;i<p.length;i++){const d=g[i]/samples.length;m[i]=.9*m[i]+.1*d;v[i]=.999*v[i]+.001*d*d;p[i]-=rate*(m[i]/a)/(Math.sqrt(v[i]/b)+1e-8);}
 }
 return loss/samples.length;
}
export function snapshot(network){return{version:1,task:network.task,weights:network.layers.filter(l=>l.type==='conv').map(l=>({w:Array.from(l.w),b:Array.from(l.b)}))};}
export function restore(saved,task=saved?.task){
 if(!saved||saved.version!==1||saved.task!==task)throw Error('Invalid model');
 const network=createNetwork(task),layers=network.layers.filter(l=>l.type==='conv');
 if(!Array.isArray(saved.weights)||saved.weights.length!==layers.length)throw Error('Invalid layers');
 layers.forEach((layer,i)=>{for(const key of ['w','b']){const values=saved.weights[i]?.[key];if(!Array.isArray(values)||values.length!==layer[key].length||!values.every(v=>Number.isFinite(v)&&Math.abs(v)<=100))throw Error('Invalid weights');layer[key].set(values);}});
 return network;
}
// The inspector uses the exact input, kernel weights and padding of the first layer.
export function inspect(network,pixels,x,y,channel=0){
 const layer=network.layers[0],size=network.task==='autoencoder'?24:12,cells=[];let sum=layer.b[channel];
 for(let ky=0;ky<3;ky++)for(let kx=0;kx<3;kx++){
  const ix=x*layer.stride+kx-1,iy=y*layer.stride+ky-1,padded=ix<0||iy<0||ix>=size||iy>=size,value=padded?0:pixels[iy*size+ix],weight=layer.w[(channel*3+ky)*3+kx];
  cells.push({x:ix,y:iy,padded,value,weight,product:value*weight});sum+=value*weight;
 }
 return{cells,bias:layer.b[channel],sum,activation:Math.tanh(sum)};
}
export function inspectNeuron(network,trace,stage,index){
 const out=trace.states[stage];if(!out||!Number.isInteger(index)||index<0||index>=out.data.length)throw Error('Invalid neuron');
 const channel=index%out.c,x=Math.floor(index/out.c)%out.w,y=Math.floor(index/(out.w*out.c));
 if(stage===0)return{stage,index,x,y,channel,kind:'input',entries:[],activation:out.data[index],bias:0,sum:out.data[index]};
 const layer=network.layers[stage-1],input=trace.states[stage-1],entries=[];
 if(layer.type==='up'){
  const ix=Math.floor(x/2),iy=Math.floor(y/2),inputIndex=(iy*input.w+ix)*input.c+channel,value=input.data[inputIndex];
  return{stage,index,x,y,channel,kind:'up',entries:[{x:ix,y:iy,channel,inputIndex,value,weight:1,product:value,padded:false}],bias:0,sum:value,activation:out.data[index]};
 }
 let sum=layer.b[channel];
 for(let c=0;c<input.c;c++)for(let ky=0;ky<3;ky++)for(let kx=0;kx<3;kx++){
  const ix=x*layer.stride+kx-1,iy=y*layer.stride+ky-1,padded=ix<0||iy<0||ix>=input.w||iy>=input.h,inputIndex=padded?null:(iy*input.w+ix)*input.c+c;
  const value=padded?0:input.data[inputIndex],weight=layer.w[((channel*3+ky)*3+kx)*input.c+c];
  entries.push({x:ix,y:iy,channel:c,inputIndex,value,weight,product:value*weight,padded});sum+=value*weight;
 }
 const calculated=layer.activation==='sigmoid'?1/(1+Math.exp(-sum)):Math.tanh(sum);
 return{stage,index,x,y,channel,kind:'conv',entries,bias:layer.b[channel],sum,activation:out.data[index],function:layer.activation,calculated,overridden:trace.intervention?.stage===stage&&Math.abs(calculated-out.data[index])>1e-6};
}
