(()=>{
 const pack=JSON.parse(document.getElementById('portable-package').textContent),frame=document.getElementById('course'),error=document.getElementById('portable-error');
 globalThis.__NEURAL_PORTABLE_PACKAGE__=pack;
 let saved;try{saved=localStorage.getItem('neural-labs.language.v1');}catch{}
 const requested=new URLSearchParams(location.search).get('lang');
 let language=['es','en'].includes(requested)?requested:['es','en'].includes(saved)?saved:'es',current;
 const script=code=>'<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>';
 function route(){
  const [name,slide]=location.hash.replace(/^#\/?/,'').split('/');
  return{page:Object.hasOwn(pack.pages,name)?name:'home',slide:slide?'#'+decodeURIComponent(slide):''};
 }
 function address(page,slide='',replace=false){
  const hash='#/'+(page==='home'?'':page)+(slide?'/'+encodeURIComponent(slide.replace(/^#/,'')):'');
  history[replace?'replaceState':'pushState'](null,'',hash);
 }
 function show(){
  const next=route(),page=pack.pages[next.page];current=next;
  globalThis.__NEURAL_PORTABLE_ROUTE__={...next,language};document.documentElement.lang=language;
  error.hidden=true;frame.srcdoc=page.html.replace('</body>',()=>script(pack.frame)+script(page.code)+'</body>');
 }
 addEventListener('message',event=>{
  if(event.source!==frame.contentWindow)return;
  const data=event.data;if(!data||typeof data!=='object')return;
  if(data.kind==='portable-navigate'&&Object.hasOwn(pack.pages,data.page)){address(data.page);show();}
  else if(data.kind==='portable-slide'&&typeof data.hash==='string'&&/^#[a-z-]+$/.test(data.hash)){current.slide=data.hash;address(current.page,data.hash,true);}
  else if(data.kind==='portable-language'&&['es','en'].includes(data.language)){
   language=data.language;document.documentElement.lang=language;
   const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url.href);
  }else if(data.kind==='portable-error'){error.textContent=language==='en'?'The course could not load. Please reopen the file in an updated browser.':'No se pudo cargar el curso. Vuelve a abrir el archivo en un navegador actualizado.';error.hidden=false;}
 });
 addEventListener('popstate',show);addEventListener('hashchange',()=>{const next=route();if(next.page!==current.page||next.slide!==current.slide)show();});
 show();
})();
