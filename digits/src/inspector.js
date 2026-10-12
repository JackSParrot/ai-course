// The inspector reads the same forward pass as the prediction. No training here.
export const finiteIndex=(value,length)=>Math.max(0,Math.min(length-1,Math.trunc(Number(value))||0));
export function neuronSelection(network,layer,neuron){
  const l=finiteIndex(layer,network.layers.length);
  return {layer:l,neuron:finiteIndex(neuron,network.layers[l].b.length)};
}
export function incomingGrid(length,pixels=false){
  const columns=pixels?16:Math.ceil(Math.sqrt(length));
  return {length,columns,rows:Math.ceil(length/columns),pixels};
}
export function connectionAt(grid,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=1||y>=1)return null;
  const i=Math.floor(y*grid.rows)*grid.columns+Math.floor(x*grid.columns);
  return i<grid.length?i:null;
}
export function numberText(value){
  if(value===0)return '0.00000';
  return Math.abs(value)<.00001||Math.abs(value)>=100000?value.toExponential(4):value.toFixed(5);
}
export function inspectNeuron(network,pixels,layer,neuron){
  const selected=neuronSelection(network,layer,neuron);
  const r=network.inspect(pixels,selected.layer,selected.neuron);
  const first=selected.layer===0,output=selected.layer===network.layers.length-1;
  const input=Float64Array.from(r.terms,t=>t.a),weights=Float64Array.from(r.terms,t=>t.w);
  const contributions=Float64Array.from(r.terms,t=>t.contribution);
  const weightedSum=contributions.reduce((sum,value)=>sum+value,0);
  const contributionBound=Math.max(0,...contributions.map(Math.abs));
  const contributionTotals=contributions.reduce((totals,value)=>{
    if(value>0)totals.positive+=value;else if(value<0)totals.negative+=value;else totals.zero++;
    return totals;
  },{positive:0,negative:0,zero:0});
  const inputKind=first?'pixels':'activations';
  const mode=network.topology.inputMode;
  const inputRange=first?(mode==='raw'?[0,255]:mode==='centered'?[-1,1]:[0,1]):network.topology.activation==='tanh'?[-1,1]:network.topology.activation==='sigmoid'?[0,1]:[0,Math.max(0,...input)];
  const weightBound=Math.max(0,...weights.map(Math.abs));
  const inputDescription=first
    ?`Píxeles 16 × 16 después de la máscara y la escala ${mode==='raw'?'0–255':mode==='centered'?'−1 a 1':'0–1'}. Un píxel silenciado llega como 0.`
    :`${input.length} activaciones de la capa oculta ${selected.layer}. Son salidas de neuronas, no píxeles del dígito.`;
  let softmax=null;
  if(output){
    const logits=r.trace.z[selected.layer],maximum=Math.max(...logits);
    softmax={maximum,numerator:Math.exp(r.z-maximum),denominator:logits.reduce((sum,z)=>sum+Math.exp(z-maximum),0),logits:Array.from(logits)};
  }
  return {...r,...selected,input,weights,contributions,weightedSum,contributionBound,contributionTotals,inputKind,inputDescription,inputRange,weightBound,grid:incomingGrid(input.length,first),activationKind:output?'softmax':network.topology.activation,output,softmax,modelName:network.topology.name,masked:first?network.topology.mask.map(x=>!x):Array(input.length).fill(false)};
}
