import test from 'node:test';
import assert from 'node:assert/strict';
import { ARROWS, MOVES, MAZES, DNA_LENGTH, ARCHIVE_LIMIT, Random, Evolution, copyMaze, validateMaze, distancesToGoal, evaluateDNA, routeSignature, rankWeights, selectParent, crossAndMutate, exportExperiment, restoreExperiment } from '../maze/src/evolution.js';

function solution(maze) {
  const d = distancesToGoal(maze), deltas = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }, dna = [];
  let {x,y} = maze.start;
  while (d[y * maze.width + x] > 0) {
    const gene = MOVES.find(move => { const [dx,dy] = deltas[move]; return maze.cells[y + dy]?.[x + dx] === '.' && d[(y + dy) * maze.width + x + dx] === d[y * maze.width + x] - 1; });
    dna.push(gene); x += deltas[gene][0]; y += deltas[gene][1];
  }
  return dna;
}
test('mazes are connected and empty DNA stays at the entrance; walls consume one gene', () => {
  for (const maze of MAZES) {
    assert.doesNotThrow(() => validateMaze(maze));
    const empty = evaluateDNA(maze, []);
    assert.equal(empty.steps, 0); assert.equal(empty.quality, 0); assert.deepEqual(empty.trace[0], {...maze.start,hit:false});
    const hit = evaluateDNA(maze, ['up']); assert.equal(hit.collisions, 1); assert.equal(hit.steps, 1); assert.equal(hit.trace[1].hit, true);
    const dna = solution(maze), result = evaluateDNA(maze, [...dna, 'up', 'left']);
    assert.equal(result.solved, true); assert.equal(result.quality, 100); assert.equal(result.steps, dna.length); assert.equal(result.bestStep, dna.length);
    assert.throws(() => evaluateDNA(maze, ['teleport']));
  }
});
test('large open fields have multiple independent 70-move routes, obstacles and dead ends', () => {
  for (const maze of MAZES) {
    assert.equal(maze.width,38); assert.equal(maze.height,38);
    const distances=distancesToGoal(maze);
    assert.equal(distances[maze.start.y*maze.width+maze.start.x],70);
    assert.ok(distances.filter(d=>d>=0).length>1000);
    const across=Array(35).fill('right'),down=Array(35).fill('down');
    const a=evaluateDNA(maze,[...across,...down]),b=evaluateDNA(maze,[...down,...across]);
    assert.ok(a.solved&&b.solved);assert.equal(a.steps,70);assert.equal(b.steps,70);
    assert.notEqual(routeSignature(a),routeSignature(b));
    const middleA=new Set(a.trace.slice(1,-1).map(p=>`${p.x},${p.y}`));
    assert.ok(b.trace.slice(1,-1).every(p=>!middleA.has(`${p.x},${p.y}`)));
    let rooms=0,deadEnds=0,obstacles=0;
    for(let y=1;y<maze.height-1;y++)for(let x=1;x<maze.width-1;x++){
      if(maze.cells[y][x]==='#'){obstacles++;continue;}
      const neighbours=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>maze.cells[y+dy][x+dx]==='.').length;
      if(neighbours===1)deadEnds++;
      if(maze.cells[y][x+1]==='.'&&maze.cells[y+1][x]==='.'&&maze.cells[y+1][x+1]==='.')rooms++;
    }
    assert.ok(rooms>500);assert.ok(obstacles>100);assert.ok(deadEnds>0);
    assert.equal(evaluateDNA(maze,Array(DNA_LENGTH).fill('up')).solved,false);
    assert.equal(evaluateDNA(maze,Array(DNA_LENGTH).fill('right')).solved,false);
    assert.throws(()=>new Evolution(maze,{length:70}),/100/);
  }
});
test('the evaluator measures free-cell distances around obstacles and ignores loops after the best cell', () => {
  const maze = MAZES[0], route = solution(maze), prefix = route.slice(0,4), result = evaluateDNA(maze,prefix);
  const opposite = {up:'down',down:'up',left:'right',right:'left'};
  const loops = evaluateDNA(maze,[...prefix,...prefix.slice().reverse().map(gene=>opposite[gene]),...prefix]);
  assert.equal(loops.bestDistance,result.bestDistance); assert.equal(loops.bestStep,result.bestStep); assert.equal(loops.quality,result.quality);
  assert.equal(result.bestDistance,route.length-4);
});
test('rank selection gives every explorer a chance and samples the actual cumulative distribution', () => {
  const ranking = ['A','B','C','D'].map(id=>({id})), slots = rankWeights(ranking);
  assert.deepEqual(slots.map(slot=>slot.probability),[.4,.3,.2,.1]);
  assert.equal(selectParent(ranking,{next:()=>0}).individual.id,'A');
  assert.equal(selectParent(ranking,{next:()=>.45}).individual.id,'B');
  assert.equal(selectParent(ranking,{next:()=>.99999}).individual.id,'D');
  assert.ok(Math.abs(slots.reduce((sum,slot)=>sum+slot.probability,0)-1)<1e-10);
});
test('crossover preserves provenance and mutation is independent per gene, with no forced change', () => {
  const a={id:'A',dna:Array(32).fill('up')},b={id:'B',dna:Array(32).fill('down')},before=structuredClone([a,b]);
  const child=crossAndMutate(a,b,new Random(42),0);
  assert.deepEqual(child.dna,[...a.dna.slice(0,child.cut),...b.dna.slice(child.cut)]); assert.equal(child.mutations.length,0);
  assert.ok(child.cut>0&&child.cut<32);
  const mutant=crossAndMutate(a,b,new Random(42),1);
  assert.equal(mutant.mutations.length,32); assert.ok(mutant.dna.every((gene,i)=>gene!==mutant.before[i]&&MOVES.includes(gene)));
  assert.deepEqual([a,b],before); child.dna[0]='right'; assert.deepEqual([a,b],before);
});
test('generation phases preserve parents, elites and the demonstrated child; seeds reproduce evolution', () => {
  const engine=new Evolution(); assert.equal(engine.phase,'empty'); assert.equal(engine.population.length,0);
  assert.throws(()=>engine.chooseParents()); engine.initialize(); assert.equal(engine.population.length,64);
  assert.equal(engine.population[0].dna.length,100); assert.ok(new Set(engine.population.map(p=>p.dna.join())).size>1);
  engine.evaluate(); const ranked=structuredClone(engine.ranking),best=engine.ranking[0].dna;
  engine.chooseParents(); engine.makeChild(); const child=structuredClone(engine.pending.child);
  assert.deepEqual(engine.ranking,ranked); engine.nextGeneration();
  assert.deepEqual(engine.population[0].dna,best); assert.deepEqual(engine.population[4].dna,child.dna);
  assert.equal(engine.population.filter(p=>p.origin==='elite').length,4);
  assert.equal(engine.population.filter(p=>p.origin==='child').length,56);
  assert.equal(engine.population.filter(p=>p.origin==='random').length,4);
  const replay=new Evolution(); replay.initialize(); replay.evaluate(); replay.chooseParents(); replay.makeChild(); replay.nextGeneration();
  assert.deepEqual(engine.population,replay.population);
});
test('actual evolution improves and discovers several physical routes on both presets without injecting a solution', () => {
  for (const maze of MAZES) {
    const engine=new Evolution(maze);engine.initialize();
    let previous=0;
    for(let generation=0;generation<200;generation++) {
      engine.evaluate(); assert.ok(engine.best.result.quality>=previous);previous=engine.best.result.quality;
      assert.ok(engine.population.every(p=>p.dna.length===100));
      if(generation<199){engine.chooseParents();engine.makeChild();engine.nextGeneration();}
    }
    assert.equal(engine.best.result.solved,true,maze.name);
    assert.equal(evaluateDNA(maze,engine.best.dna).solved,true);
    assert.ok(engine.history.at(-1).mean>engine.history[0].mean*3);
    assert.ok(engine.history.at(-1).routes>2);
    assert.ok(engine.best.result.steps<100);
  }
});
test('save/restore retains population, evaluator, mutation ancestry and the random generator', () => {
  const engine=new Evolution(MAZES[1]);engine.initialize();engine.evaluate();engine.chooseParents();engine.makeChild();engine.nextGeneration();engine.evaluate();
  const data=JSON.parse(JSON.stringify(exportExperiment(engine))), restored=restoreExperiment(data);
  assert.deepEqual(restored.population,engine.population);assert.deepEqual(restored.history,engine.history);assert.deepEqual(restored.archive,engine.archive);assert.deepEqual(restored.best.dna,engine.best.dna);assert.deepEqual(restored.best.result,engine.best.result);
  engine.chooseParents();restored.chooseParents();engine.makeChild();restored.makeChild();assert.deepEqual(restored.pending,engine.pending);
  for(const corrupt of [d=>d.population[0].dna[0]='invalid',d=>d.randomState=-1,d=>d.generation=-1,d=>d.population.pop(),d=>d.history[0].mean=200,d=>d.best.dna=[],d=>d.archive[0].population[0].dna='9'.repeat(100),d=>d.archive[0].population[0].id='G9-01',d=>d.history[0].routes=100]) {
    const broken=structuredClone(data);corrupt(broken);assert.throws(()=>restoreExperiment(broken));
  }
});
test('replays preserve the first and latest generations without changing evolution or its random state',()=>{
  const e=new Evolution();e.initialize();e.evaluate();const first=structuredClone(e.population);
  for(let i=0;i<ARCHIVE_LIMIT+10;i++){e.cycle();e.evaluate();}
  assert.equal(e.archive.length,ARCHIVE_LIMIT+1);assert.equal(e.archive[0].generation,1);
  assert.equal(e.archive[1].generation,e.generation-ARCHIVE_LIMIT+1);
  const before=JSON.stringify(exportExperiment(e));
  const replay=e.generationPopulation(1);
  assert.deepEqual(replay.map(p=>p.dna),first.map(p=>p.dna));
  assert.deepEqual(replay.map(p=>p.result),first.map(p=>p.result));
  replay[0].dna[0]='right';assert.equal(JSON.stringify(exportExperiment(e)),before);
  const restored=restoreExperiment(JSON.parse(before));
  assert.deepEqual(restored.archive,e.archive);assert.deepEqual(restored.generationPopulation(1),e.generationPopulation(1));
});
test('different DNA tails and wall hits do not inflate the number of physical routes',()=>{
  const maze=MAZES[0],dna=solution(maze),a=evaluateDNA(maze,dna),b=evaluateDNA(maze,['up',...dna,...Array(29).fill('left')]);
  assert.equal(a.solved,true);assert.equal(b.solved,true);assert.notEqual(a.steps,b.steps);assert.equal(routeSignature(a),routeSignature(b));
});
test('custom fields that need more than 100 moves are rejected',()=>{
  const size=38,cells=Array.from({length:size},()=>Array(size).fill('#'));
  for(let y=1;y<size-1;y+=2){for(let x=1;x<size-1;x++)cells[y][x]='.';if(y+1<size-1)cells[y+1][((y-1)/2)%2===0?size-2:1]='.';}
  const maze={width:size,height:size,cells:cells.map(row=>row.join('')),start:{x:1,y:1},goal:{x:1,y:35}};
  assert.throws(()=>validateMaze(maze),/100 movimientos/);
});
test('maze edits must preserve a route and do not mutate presets', () => {
  const maze=copyMaze(MAZES[0]),original=structuredClone(MAZES[0]);
  maze.cells[1]='#.#'+ '#'.repeat(maze.width-3); maze.cells[2]='#'.repeat(maze.width);
  assert.throws(()=>validateMaze(maze),/aislado/);assert.deepEqual(MAZES[0],original);
  assert.equal(Object.keys(ARROWS).length,4);
});
