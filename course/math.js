// Pure teaching math: the visuals and tests call these same functions.
export const NAND = Object.freeze([
  {x:[0,0], y:1}, {x:[1,0], y:1}, {x:[0,1], y:1}, {x:[1,1], y:0}
]);
export const OR = Object.freeze(NAND.map(({x}) => ({x:[...x], y:x.some(Boolean) ? 1 : 0})));
export const XOR = Object.freeze(NAND.map(({x}) => ({x:[...x], y:x[0] !== x[1] ? 1 : 0})));
export function score(model,x) {
  const terms=[model.weights[0]*x[0],model.weights[1]*x[1],model.bias];
  const z=terms[0]+terms[1]+terms[2];
  // Preserve the z >= 0 convention when decimal inputs cancel at the boundary.
  // Only discard floating-point roundoff, scaled to the actual terms.
  return Math.abs(z)<=4*Number.EPSILON*terms.reduce((sum,v)=>sum+Math.abs(v),0)?0:z;
}
export const hard = z => z >= 0 ? 1 : 0;
export const accuracy = (classifier, samples) => samples.filter(s=>classifier(s.x)===s.y).length;
export const XOR_PARAMETER_KEYS=Object.freeze(['h1w1','h1w2','b1','h2w1','h2w2','b2','v1','v2','bo']);
export const XOR_CHALLENGE=Object.freeze({h1w1:1,h1w2:1,b1:-.5,h2w1:1,h2w2:1,b2:-.5,v1:1,v2:1,bo:-1.5});
export const XOR_SOLUTION=Object.freeze({...XOR_CHALLENGE,h2w1:-1,h2w2:-1,b2:1.5});
export const xorHiddenModels=p=>[{weights:[p.h1w1,p.h1w2],bias:p.b1},{weights:[p.h2w1,p.h2w2],bias:p.b2}];
export function manualXor(p,x){
  const hiddenScores=xorHiddenModels(p).map(model=>score(model,x));
  const hidden=hiddenScores.map(hard);
  const outputScore=score({weights:[p.v1,p.v2],bias:p.bo},hidden);
  return {hiddenScores,hidden,outputScore,output:hard(outputScore)};
}
// The equation is w1*x + w2*y + b = 0. Clip it to the visible square.
export function boundarySegment(model, low=-0.2, high=1.2) {
  const [a,b]=model.weights,c=model.bias, points=[];
  const add=(x,y)=>{
    if(x<low-1e-9||x>high+1e-9||y<low-1e-9||y>high+1e-9)return;
    if(!points.some(p=>Math.hypot(p[0]-x,p[1]-y)<1e-8))points.push([x,y]);
  };
  if(Math.abs(b)>1e-10){add(low,(-c-a*low)/b);add(high,(-c-a*high)/b);}
  if(Math.abs(a)>1e-10){add((-c-b*low)/a,low);add((-c-b*high)/a,high);}
  return points.length>=2 ? [points[0],points[1]] : [];
}

// One control scale shared by drag, keyboard, touch buttons and exact entry.
export const DIAL={min:-3,max:3,step:0.1,pixelsPerUnit:35};
export function dialValue(raw) {
  if(raw===null||raw===undefined||(typeof raw==='string'&&!raw.trim()))return null;
  const value=Number(raw);
  if(!Number.isFinite(value))return null;
  return Math.round(Math.min(DIAL.max,Math.max(DIAL.min,value))*10)/10;
}
export const dialAngle=value=>-135+(value-DIAL.min)/(DIAL.max-DIAL.min)*270;
export const dialDragValue=(start,startY,currentY)=>dialValue(start+(startY-currentY)/DIAL.pixelsPerUnit);
export function dialKeyValue(value,key) {
  const changes={ArrowUp:.1,ArrowRight:.1,ArrowDown:-.1,ArrowLeft:-.1,PageUp:.5,PageDown:-.5};
  if(key==='Home')return DIAL.min;
  if(key==='End')return DIAL.max;
  return Object.hasOwn(changes,key)?dialValue(value+changes[key]):null;
}
