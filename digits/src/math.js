export function rng(seed=42){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let a=Math.imul(t^t>>>15,1|t);a^=a+Math.imul(a^a>>>7,61|a);return((a^a>>>14)>>>0)/4294967296;};}
export function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function softmax(logits){const m=Math.max(...logits);const ex=Float64Array.from(logits,x=>Math.exp(x-m)),sum=ex.reduce((a,b)=>a+b,0);return ex.map(x=>x/sum);}
export function argmax(a){let k=0;for(let i=1;i<a.length;i++)if(a[i]>a[k])k=i;return k;}
export function crossEntropy(logits,label){const m=Math.max(...logits);return m+Math.log(logits.reduce((s,x)=>s+Math.exp(x-m),0))-logits[label];}
export const activate=(z,kind)=>kind==='relu'?Math.max(0,z):kind==='tanh'?Math.tanh(z):1/(1+Math.exp(-z));
export const derivative=(a,z,kind)=>kind==='relu'?(z>0?1:0):kind==='tanh'?1-a*a:a*(1-a);
