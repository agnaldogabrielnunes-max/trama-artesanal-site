(function(){try{
 var p=new URLSearchParams(location.search).get('ref');
 if(p){p=p.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,30);
  if(p){localStorage.setItem('trama_ref',JSON.stringify({c:p,t:Date.now()}));
   fetch('https://qgunpfgdsqqgfkimvwhg.supabase.co/rest/v1/rpc/afiliado_registrar_clique',{method:'POST',headers:{'Content-Type':'application/json',apikey:'sb_publishable_zf7UMVosztpLCHpAYRvoHA_WX9_X0wy'},body:JSON.stringify({p_codigo:p,p_pagina:location.pathname})}).catch(function(){});}}
 var r=JSON.parse(localStorage.getItem('trama_ref')||'null'); if(r&&Date.now()-r.t>30*864e5)localStorage.removeItem('trama_ref');
}catch(e){}})();
