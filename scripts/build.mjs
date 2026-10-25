import {buildPortable} from './portable/build.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outArg=process.argv.find(arg=>arg.startsWith('--out='));
const releaseRoot=outArg?resolve(root,outArg.slice(6)):root;
if(releaseRoot!==root&&!releaseRoot.startsWith(root+sep))throw Error('Build output must stay inside this project.');
const publicRoot=join(releaseRoot,'public');
const sources={cars:join(root,'cars'),digits:join(root,'digits'),maze:join(root,'maze'),perceptrons:join(root,'course'),autoencoder:join(root,'autoencoder'),superresolution:join(root,'superresolution'),tokens:join(root,'tokens'),predictor:join(root,'predictor'),attention:join(root,'attention'),assistant:join(root,'assistant')};
// Deliberate allowlist: no repository roots, private checkpoints or original download caches.
const files={
autoencoder:['index.html','styles.css',...['app','network','data','viewer','worker'].map(n=>'src/'+n+'.js')],
superresolution:['index.html','src/app.js'],
maze:['index.html','styles.css','src/evolution.js','src/app.js'],
cars:['index.html','favicon.svg','styles.css','map-editor.css','topology-editor.css','training.css',...['app','car-settings','car','controls','genetics','geometry','map-editor','map-store','map-ui','maps','neural-network','renderer','sensor','simulation','topology-editor','topology-store','topology','track-drawing','track','trained-models','training-chart','training-engine','training-score','training-ui','training-worker'].map(n=>'src/'+n+'.js')],
digits:['index.html','favicon.svg','styles.css',...['app','data','editors','experiment','inspector','network-viewer','math','model','view','worker'].map(n=>'src/'+n+'.js'),'data/manifest.json','data/train.bin','data/validation.bin','data/test.bin','data/PROVENANCE.md'],
perceptrons:['index.html','course.css','lesson.js','math.js'],
tokens:['index.html','styles.css',...['app','bpe','corpus','ui'].map(n=>'src/'+n+'.js')],
predictor:['index.html',...['app','embedding-map','model','worker'].map(n=>'src/'+n+'.js')],
attention:['index.html',...['app','transformer','worker'].map(n=>'src/'+n+'.js')],
assistant:['index.html',...['app','training','world','worker'].map(n=>'src/'+n+'.js')]
};
const chapters=[{app:'perceptrons',title:'Perceptrones'},{app:'digits',title:'Aprender a leer'},{app:'autoencoder',title:'Autoencoder'},{app:'superresolution',title:'Superresolución'},{app:'maze',title:'Algoritmos genéticos'},{app:'cars',title:'Coches'},{app:'tokens',title:'Tokens'},{app:'predictor',title:'Siguiente token'},{app:'attention',title:'Atención'},{app:'assistant',title:'Del modelo al asistente'}];
const digest=b=>createHash('sha256').update(b).digest('hex'),captured=[];
for(const [app,list]of Object.entries(files))for(const file of list){
 const source=join(sources[app],file),buffer=await readFile(source);
 captured.push({app,file,source,buffer,sha256:digest(buffer)});
}
for(const item of captured)if(digest(await readFile(item.source))!==item.sha256)throw Error('Source changed while building: '+item.app+'/'+item.file);
const sharedFiles=['i18n.js','dom.js','en.js','images.js','tokens.js','language.css'];
const shared=await Promise.all(sharedFiles.map(async file=>({file,buffer:await readFile(join(root,'i18n',file))})));
const languageVersion=digest(Buffer.concat(shared.map(item=>item.buffer))).slice(0,12);
const languageAssets=prefix=>'<link rel="stylesheet" href="'+prefix+'i18n/language.css?v='+languageVersion+'">\n<script type="module" src="'+prefix+'i18n/dom.js?v='+languageVersion+'"></script>\n';
const template=await readFile(join(root,'shell/navigation.html'),'utf8');
const darkVersion=digest(await readFile(join(root,'shell/dark.css'))).slice(0,12);
const darkAssets=prefix=>'<link rel="stylesheet" href="'+prefix+'dark.css?v='+darkVersion+'">\n';
const navVersion=digest(await readFile(join(root,'shell/hub-nav.css'))).slice(0,12);
const landingVersion=digest(await readFile(join(root,'shell/landing.css'))).slice(0,12);
const courseVersion=digest(Buffer.concat(captured.filter(item=>item.app==='perceptrons').map(item=>item.buffer))).slice(0,12);
const appVersion=(...apps)=>digest(Buffer.concat(captured.filter(item=>apps.includes(item.app)&&!item.file.startsWith('data/')).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0).map(item=>item.buffer))).slice(0,12);
// Chapters 07–10 share modules and styles, so they share one version.
const textVersion=appVersion('tokens','predictor','attention','assistant');
const versions={digits:appVersion('digits'),tokens:textVersion,predictor:textVersion,attention:textVersion,assistant:textVersion},digitsVersion=versions.digits;
function navigation(app){
 const index=chapters.findIndex(c=>c.app===app),number=String(index+1).padStart(2,'0');
 const previous=index>0?'<a class="course-previous" href="../'+chapters[index-1].app+'/">← Anterior: '+chapters[index-1].title+'</a>':'<a class="course-previous" href="../">← Índice del curso</a>';
 const next=index<chapters.length-1?'<a class="course-next" href="../'+chapters[index+1].app+'/">Siguiente: '+chapters[index+1].title+' →</a>':'<a class="course-next" href="../">Volver al curso →</a>';
 const links=chapters.map((c,i)=>'<li><a href="../'+c.app+'/"'+(c.app===app?' aria-current="page"':'')+'>'+String(i+1).padStart(2,'0')+' · '+c.title+'</a></li>').join('');
 return {top:template.replace('{{chapter-links}}',links).replace('{{chapter-label}}','CAPÍTULO '+number+' / '+String(chapters.length).padStart(2,'0')).replace('{{previous-link}}',previous).replace('{{next-link}}',next),bottom:'<nav class="course-bottom-nav" aria-label="Continuar el curso">'+previous+(index>0&&index<chapters.length-1?'<a class="course-home" href="../">Índice del curso</a>':'')+next+'</nav>'};
}
const manifest={version:1,builtAt:new Date().toISOString(),files:{},sources:{},courseSources:{}};
await mkdir(publicRoot,{recursive:true});
for(const item of captured){
 let output=item.buffer;
 if(item.file.endsWith('.js'))output=Buffer.from(output.toString('utf8').replace(/(['"])(\.\.\/(?:\.\.\/)?i18n\/i18n\.js)\1/g,(_,quote,path)=>quote+path+'?v='+languageVersion+quote));
 if(versions[item.app]&&item.file.endsWith('.js'))output=Buffer.from(output.toString('utf8').replace(/(['"])(\.\/[a-z-]+\.js|\.\.\/\.\.\/(?:tokens|predictor|attention)\/src\/[a-z-]+\.js)\1/g,(_,quote,path)=>quote+path+'?v='+versions[item.app]+quote));
 if(item.app==='perceptrons'&&item.file==='lesson.js')output=Buffer.from(output.toString('utf8').replace("'./math.js'","'./math.js?v="+courseVersion+"'"));
 if(item.file==='index.html'){
   let html=output.toString('utf8');if(!html.includes('</head>')||!/<body(?:\s[^>]*)?>/.test(html)||!html.includes('</body>'))throw Error('Unexpected HTML document.');
   const nav=navigation(item.app);
   html=html.replace('</head>',languageAssets('../')+'<link rel="stylesheet" href="../hub-nav.css?v='+navVersion+'">\n'+darkAssets('../')+'</head>').replace(/<body(?:\s[^>]*)?>/,tag=>tag+'\n'+nav.top).replace('</body>',nav.bottom+'\n</body>');
   if(item.app==='cars')html=html.replace(/Laboratorio 01/i,'Capítulo 06').replace('LABORATORIO <b>01</b>','CAPÍTULO <b>06</b>');
   if(item.app==='digits')html=html.replace(/Laboratorio 02/i,'Capítulo 02').replace('LABORATORIO <b>02</b>','CAPÍTULO <b>02</b>');
   if(versions[item.app])html=html.replace('href="./styles.css"','href="./styles.css?v='+versions[item.app]+'"').replace('href="../tokens/styles.css"','href="../tokens/styles.css?v='+versions[item.app]+'"').replace('src="./src/app.js"','src="./src/app.js?v='+versions[item.app]+'"');
   if(item.app==='perceptrons')html=html.replace('href="./course.css"','href="./course.css?v='+courseVersion+'"').replace('src="./lesson.js"','src="./lesson.js?v='+courseVersion+'"');
   output=Buffer.from(html);
 }
 const name=item.app+'/'+item.file,target=join(publicRoot,name);
 await mkdir(dirname(target),{recursive:true});await writeFile(target,output);
 manifest.files['/'+name]={bytes:output.length,sha256:digest(output)};
 (item.app==='perceptrons'?manifest.courseSources:manifest.sources)[name]={sha256:item.sha256};
}
for(const file of ['index.html','landing.css','hub-nav.css','dark.css']){
 let bytes=await readFile(join(root,'shell',file));
 if(file==='index.html')bytes=Buffer.from(bytes.toString('utf8').replace('href="./landing.css"','href="./landing.css?v='+landingVersion+'"').replace('</head>',languageAssets('./')+darkAssets('./')+'</head>'));
 await writeFile(join(publicRoot,file),bytes);
 manifest.files['/'+file]={bytes:bytes.length,sha256:digest(bytes)};
}
for(const {file,buffer} of shared){
 const name='i18n/'+file;
 // Version internal imports together with the selector to avoid mixed catalog caches.
 const output=file.endsWith('.js')?Buffer.from(buffer.toString('utf8').replace(/(['"])(\.\/[a-z0-9-]+\.js)\1/g,(_,quote,path)=>quote+path+'?v='+languageVersion+quote)):buffer;
 await mkdir(join(publicRoot,'i18n'),{recursive:true});
 await writeFile(join(publicRoot,name),output);
 manifest.files['/'+name]={bytes:output.length,sha256:digest(output)};
}
await writeFile(join(releaseRoot,'publication-manifest.json'),JSON.stringify(manifest,null,2));
const portable=await buildPortable(root,releaseRoot);
console.log(JSON.stringify({...portable,files:Object.keys(manifest.files).length,bytes:Object.values(manifest.files).reduce((n,f)=>n+f.bytes,0),releaseRoot,sourceChanges:0}));
