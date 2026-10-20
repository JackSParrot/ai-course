// A fresh document keeps each chapter's styles and event handlers isolated.
(()=>{
 const pack=parent.__NEURAL_PORTABLE_PACKAGE__,config=parent.__NEURAL_PORTABLE_ROUTE__,workers=[],urls=[];
 const send=(kind,detail)=>parent.postMessage({kind,...detail},'*');
 function links(language){
  for(const anchor of document.querySelectorAll('a[data-portable-page]')){
   const url=new URL(parent.location.href),page=anchor.dataset.portablePage;
   url.hash='/'+(page==='home'?'':page);url.searchParams.set('lang',language);anchor.href=url.href;
  }
 }
 links(config.language);
 globalThis.__NEURAL_PORTABLE__={
  assets:pack.assets,search:'?lang='+config.language,hash:config.slide,
  setLanguage(language){links(language);send('portable-language',{language});},
  setSlide(hash){this.hash=hash;send('portable-slide',{hash});},
  worker(name){
   const source='globalThis.__NEURAL_PORTABLE__={assets:'+JSON.stringify(pack.assets)+'};\n'+pack.workers[name];
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);
   urls.push(url);workers.push(worker);return worker;
  }
 };
 document.addEventListener('click',event=>{
  const anchor=event.target.closest?.('a[data-portable-page]');if(!anchor||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();send('portable-navigate',{page:anchor.dataset.portablePage});
 });
 addEventListener('pagehide',()=>{workers.forEach(worker=>worker.terminate());urls.forEach(url=>URL.revokeObjectURL(url));});
 addEventListener('error',event=>send('portable-error',{message:event.message}));
})();
