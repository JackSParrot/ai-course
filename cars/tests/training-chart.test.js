import test from 'node:test';
import assert from 'node:assert/strict';
import {drawTrainingChart} from '../src/training-chart.js';

test('a completed generation draws both curves using the theme colors',()=>{
 const previousWindow=globalThis.window,previousStyle=globalThis.getComputedStyle;
 try{
  globalThis.window={devicePixelRatio:1};
  for(const palette of [['#638448','#aba68d'],['#abc89c','#c1ae92']]){
   globalThis.getComputedStyle=()=>({getPropertyValue:token=>({'--plot-line':palette[0],'--plot-second-line':palette[1]}[token]??'')});
   const strokes=[],ctx={setTransform(){},clearRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},setLineDash(){},arc(){},fill(){},stroke(){strokes.push(this.strokeStyle);}};
   const canvas={width:600,height:330,clientWidth:600,getContext:()=>ctx};
   assert.doesNotThrow(()=>drawTrainingChart(canvas,[{generation:1,best:14,average:8}]));
   assert.deepEqual(strokes.slice(-2),[palette[1],palette[0]]);
  }
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  if(previousStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=previousStyle;
 }
});
