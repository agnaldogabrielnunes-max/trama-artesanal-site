/* LAR · módulos financeiros: DRE (receita do bolo), documentos (leitor), conciliação, lotes de pagamento */
const GRUPOS=[['receita','Receita bruta'],['deducoes','Deduções da receita'],['custo','Custo do produto (CMV)'],['pessoal','Pessoal'],['administrativas','Despesas administrativas'],['comerciais','Comerciais e marketing'],['logistica','Logística'],['financeiras','Despesas financeiras'],['impostos_lucro','Impostos sobre o lucro'],['fora_dre','Fora do DRE (caixa)']];
const pedirEmpresa=v=>{if(S.emp==='all'){v.innerHTML=empty('Escolha uma empresa no topo da tela para abrir este módulo.');return true}return false};
const mesISO=()=>{S.dreMes=S.dreMes||new Date().toISOString().slice(0,7);return S.dreMes+'-01'};
const num=s=>{s=String(s??'').trim();if(!s)return 0;if(s.includes(',')){s=s.replace(/[R$\s.]/g,'').replace(',','.')}return Number(s)||0};
const pct=(a,b)=>b?((a/b)*100).toFixed(1).replace('.',',')+'%':'—';

async function dreCalc(){
  const {data,error}=await sb.rpc('dre_mes',{p_empresa:S.emp,p_mes:mesISO()});
  const rows=(error?[]:data||[]).map(r=>({...r,manual:Number(r.manual),lancado:Number(r.lancado),total:Number(r.manual)+Number(r.lancado)}));
  const g=k=>rows.filter(r=>r.grupo===k).reduce((a,r)=>a+r.total,0);
  const RB=g('receita'),DED=g('deducoes'),CMV=g('custo'),PES=g('pessoal'),ADM=g('administrativas'),COM=g('comerciais'),LOG=g('logistica'),FIN=g('financeiras'),IR=g('impostos_lucro');
  const RL=RB-DED,LB=RL-CMV,DOP=PES+ADM+COM+LOG,RO=LB-DOP,LAIR=RO-FIN,LL=LAIR-IR;
  return {rows,RB,DED,RL,CMV,LB,PES,ADM,COM,LOG,DOP,RO,FIN,LAIR,IR,LL};
}
PAGES.dre=async v=>{
  if(pedirEmpresa(v))return;
  $('#tools').innerHTML=`<input type="month" id="dm" value="${S.dreMes||new Date().toISOString().slice(0,7)}" style="width:auto">`;
  $('#dm').onchange=e=>{S.dreMes=e.target.value;render()};
  S.dreTab=S.dreTab||'bolo';
  const c=await dreCalc();
  const {data:cfg}=await sb.from('dre_config').select('margem_desejada').eq('empresa_id',S.emp).maybeSingle();
  const {data:fech}=await sb.from('dre_fechamentos').select('mes,resumo,fechado_por,criado_em,dados').eq('empresa_id',S.emp).order('mes',{ascending:false}).limit(12);
  const tabs=[['bolo','Receita do bolo'],['dre','DRE do mês'],['margem','Margem e preço'],['fech','Fechamentos']];
  const linha=(n,val,opt={})=>`<tr style="${opt.b?'font-weight:700;background:var(--panel2)':''}"><td>${opt.i?'&nbsp;&nbsp;&nbsp;':''}${n}</td><td style="text-align:right">${R(val)}</td><td style="text-align:right;color:var(--mut)">${pct(val,c.RB)}</td></tr>`;
  let corpo='';
  if(S.dreTab==='bolo'){
    corpo=`<p class="d" style="margin-bottom:12px">Preencha o que a empresa teve em cada linha neste mês. O que já foi lançado no Financeiro (com categoria) soma automaticamente — o campo abaixo é para o que ainda não está lançado. Salva ao sair do campo.</p>`+GRUPOS.map(([k,nm])=>{const L=c.rows.filter(r=>r.grupo===k);return `<div class="card" style="margin-bottom:12px"><h3>${nm} <span style="float:right">${R(L.reduce((a,r)=>a+r.total,0))}</span></h3><div class="tw"><table><thead><tr><th>Linha</th><th style="width:150px">Valor do mês (R$)</th><th style="width:120px;text-align:right">Já lançado</th></tr></thead><tbody>${L.map(r=>`<tr><td>${esc(r.categoria)}</td><td><input class="dv" data-c="${r.categoria_id}" value="${r.manual?String(r.manual).replace('.',','):''}" placeholder="0,00" inputmode="decimal"></td><td style="text-align:right;color:var(--mut)">${r.lancado?R(r.lancado):'—'}</td></tr>`).join('')}</tbody></table></div></div>`}).join('');
  }else if(S.dreTab==='dre'){
    corpo=`<div class="card"><table><thead><tr><th>DRE · ${S.dreMes}</th><th style="text-align:right">Valor</th><th style="text-align:right">% da receita</th></tr></thead><tbody>
    ${linha('Receita bruta',c.RB,{b:1})}${linha('(−) Deduções (impostos s/ venda, taxas, marketplace)',c.DED,{i:1})}${linha('Receita líquida',c.RL,{b:1})}
    ${linha('(−) Custo do produto (CMV)',c.CMV,{i:1})}${linha('Lucro bruto',c.LB,{b:1})}
    ${linha('(−) Pessoal',c.PES,{i:1})}${linha('(−) Administrativas',c.ADM,{i:1})}${linha('(−) Comerciais e marketing',c.COM,{i:1})}${linha('(−) Logística',c.LOG,{i:1})}
    ${linha('Resultado operacional',c.RO,{b:1})}${linha('(−) Despesas financeiras',c.FIN,{i:1})}${linha('Resultado antes dos impostos s/ lucro',c.LAIR,{b:1})}${linha('(−) Impostos sobre o lucro',c.IR,{i:1})}${linha('LUCRO LÍQUIDO',c.LL,{b:1})}
    </tbody></table></div><div class="card" style="margin-top:12px"><canvas id="dc" height="110"></canvas></div>`;
  }else if(S.dreTab==='margem'){
    const dedP=c.RB?c.DED/c.RB*100:0,dopP=c.RB?c.DOP/c.RB*100:0,finP=c.RB?c.FIN/c.RB*100:0,irP=c.RB?c.IR/c.RB*100:0;
    corpo=`<div class="card" style="max-width:640px"><h3>Quanto cobrar para ganhar a margem que você quer</h3>
    <p class="d">Usa os percentuais reais deste mês (despesas ÷ receita bruta). Se o mês ainda está vazio, ajuste os percentuais à mão.</p>
    <label>Custo do produto (material + mão de obra + embalagem), R$</label><input id="mc" inputmode="decimal" placeholder="0,00">
    <label>Margem líquida desejada (%)</label><input id="mm" value="${cfg?.margem_desejada??30}" inputmode="decimal">
    <div class="grid g2"><div><label>Deduções sobre a venda (%)</label><input id="md" value="${dedP.toFixed(1)}"></div><div><label>Despesas operacionais (%)</label><input id="mo" value="${dopP.toFixed(1)}"></div><div><label>Financeiras (%)</label><input id="mf" value="${finP.toFixed(1)}"></div><div><label>Impostos s/ lucro (%)</label><input id="mi" value="${irP.toFixed(1)}"></div></div>
    <button class="btn" id="mgo" style="margin-top:12px">Calcular preço de venda</button><div id="mres" style="margin-top:14px;font-size:15px"></div></div>`;
  }else{
    corpo=`<div class="card"><button class="btn" id="fechar">Fechar o mês ${S.dreMes} agora</button> <span class="d">O Agente Administrativo também fecha sozinho todo dia 30.</span></div><div class="card" style="margin-top:12px">${tbl(['Mês','Receita','Lucro líquido','Fechado por','Resumo'],(fech||[]).map(f=>[f.mes.slice(0,7),R(f.dados?.RB),R(f.dados?.LL),esc(f.fechado_por||'Agente Administrativo'),esc(f.resumo||'')]))}</div>`;
  }
  v.innerHTML=`<div class="seg" style="margin-bottom:14px">${tabs.map(([k,l])=>`<button data-t="${k}" class="${S.dreTab===k?'on':''}">${l}</button>`).join('')}</div>${corpo}`;
  v.querySelector('.seg').onclick=e=>{const b=e.target.closest('[data-t]');if(b){S.dreTab=b.dataset.t;render()}};
  if(S.dreTab==='bolo')v.querySelectorAll('.dv').forEach(i=>i.onchange=async()=>{
    const val=num(i.value);const {error}=await sb.from('dre_valores').upsert({empresa_id:S.emp,mes:mesISO(),categoria_id:i.dataset.c,valor:val,atualizado_em:new Date().toISOString()},{onConflict:'empresa_id,mes,categoria_id'});
    i.style.outline=error?'2px solid #ff6b6b':'2px solid #3FA7BA';setTimeout(()=>i.style.outline='',900)});
  if(S.dreTab==='dre')chart('dc',{type:'bar',data:{labels:['Receita','Deduções','CMV','Despesas op.','Financeiras','Lucro líquido'],datasets:[{data:[c.RB,c.DED,c.CMV,c.DOP,c.FIN,c.LL],backgroundColor:['#3FA7BA','#8FB0BD','#8FB0BD','#8FB0BD','#8FB0BD','#F57C20'],borderRadius:6}]},options:{plugins:{legend:{display:false}}}});
  if(S.dreTab==='margem')$('#mgo').onclick=async()=>{
    const custo=num($('#mc').value),m=num($('#mm').value),s=num($('#md').value)+num($('#mo').value)+num($('#mf').value)+num($('#mi').value);
    await sb.from('dre_config').upsert({empresa_id:S.emp,margem_desejada:m});
    const div=1-(s+m)/100;
    $('#mres').innerHTML=!custo?'Informe o custo do produto.':div<=0?`<b style="color:#ff8a6b">Impossível:</b> despesas (${s.toFixed(1)}%) + margem (${m}%) passam de 100% da venda. Reduza a margem ou as despesas.`:`Preço de venda mínimo: <b style="font-size:22px;color:var(--orange)">${R(custo/div)}</b><br><span class="d">Para cada R$ 100 vendidos: R$ ${s.toFixed(1)} vão para despesas e impostos, R$ ${m} ficam de lucro e o custo do produto é R$ ${(100*div).toFixed(1)}.</span>`;
  };
  if(S.dreTab==='fech')$('#fechar').onclick=async()=>{
    const resumo=`Receita ${R(c.RB)} · lucro líquido ${R(c.LL)} (${pct(c.LL,c.RB)}) · despesas operacionais ${pct(c.DOP,c.RB)} da receita.`;
    const {error}=await sb.from('dre_fechamentos').upsert({empresa_id:S.emp,mes:mesISO(),dados:{RB:c.RB,DED:c.DED,CMV:c.CMV,DOP:c.DOP,FIN:c.FIN,IR:c.IR,LL:c.LL},resumo,fechado_por:S.user.email},{onConflict:'empresa_id,mes'});
    if(error)alert('Erro: '+error.message);else render();
  };
};
PAGES.dre.meta=['DRE e receita do bolo','Preencha os custos do mês, veja o resultado e calcule o preço pela margem desejada'];

/* ---------- documentos: leitor de nota, conta e comprovante ---------- */
const CATS_DOC={nf_entrada:['Matéria-prima e material','Mercadoria para revenda / fornecedor'],conta_consumo:['Energia elétrica','Água e esgoto','Internet e telefone'],comprovante_pagamento:[]};
PAGES.documentos=async v=>{
  if(pedirEmpresa(v))return;
  const [docs,cats]=await Promise.all([q('documentos','id,tipo,nome,status,storage_path,dados,criado_em',b=>b.order('criado_em',{ascending:false}).limit(30)),q('financeiro_categorias','id,nome,grupo,tipo',b=>b.eq('ativo',true).order('nome'))]);
  S.docCats=cats;
  v.innerHTML=`<div class="card" style="max-width:760px"><h3>Enviar documento</h3>
   <p class="d">Fotografe com a câmera do celular, escaneie ou envie o arquivo. A nota em <b>XML</b> é lida com 100% de precisão; foto e PDF usam a IA LAR.</p>
   <label>Tipo</label><select id="dt"><option value="nf_entrada">Nota fiscal de compra (entrada de produtos)</option><option value="conta_consumo">Conta de energia, água, internet…</option><option value="comprovante_pagamento">Comprovante de pagamento</option></select>
   <label>Arquivo ou foto</label><input type="file" id="df" accept="image/*,application/pdf,.xml" capture="environment">
   <button class="btn" id="dgo" style="margin-top:12px">Enviar e ler</button><p id="dmsg" class="d" style="margin-top:8px"></p><div id="dprev"></div></div>
   <div class="card" style="margin-top:16px"><h3>Banco de documentos</h3>${tbl(['Data','Tipo','Arquivo','Status',''],docs.map(d=>[DT(d.criado_em),esc(d.tipo.replace(/_/g,' ')),esc(d.nome||''),stPill(d.status),`<a href="#" data-p="${esc(d.storage_path)}" class="vd">abrir</a>`]))}</div>`;
  v.onclick=async e=>{const a=e.target.closest('.vd');if(!a)return;e.preventDefault();const {data}=await sb.storage.from('documentos').createSignedUrl(a.dataset.p,300);if(data)window.open(data.signedUrl,'_blank')};
  $('#dgo').onclick=async()=>{
    const f=$('#df').files[0];if(!f){$('#dmsg').textContent='Escolha um arquivo ou tire uma foto.';return}
    $('#dmsg').textContent='Enviando…';const tipo=$('#dt').value;
    const path=`${S.emp}/${new Date().toISOString().slice(0,7)}/${Date.now()}-${f.name.replace(/[^\w.-]/g,'_')}`;
    const up=await sb.storage.from('documentos').upload(path,f);if(up.error){$('#dmsg').textContent='Falha no envio: '+up.error.message;return}
    const {data:doc}=await sb.from('documentos').insert({empresa_id:S.emp,tipo,nome:f.name,storage_path:path,criado_por:S.user.email}).select('id').single();
    $('#dmsg').textContent='Lendo o documento…';
    const {data,error}=await sb.functions.invoke('ler-documento',{body:{path,tipo}});
    let r=data;if(!r&&error){try{r=await error.context.json()}catch(e){r={}}}
    if(!r?.ok){$('#dmsg').textContent=r?.mensagem||'Não consegui ler. O arquivo ficou guardado no banco de documentos.';return}
    $('#dmsg').textContent='Confira os dados antes de lançar.';previewDoc(r.dados,tipo,doc?.id);
  };
};
PAGES.documentos.meta=['Documentos e leitor de notas','Foto, scanner ou XML → lança no financeiro e no estoque'];
function previewDoc(d,tipo,docId){
  const cats=(S.docCats||[]).filter(c=>c.tipo==='pagar'||c.grupo!=='receita');
  const sug=d.categoria_sugerida||(CATS_DOC[tipo]||[])[0]||'';
  const itens=d.itens||[];
  $('#dprev').innerHTML=`<hr style="margin:16px 0;opacity:.2"><h4>Conferir e lançar</h4>
   <div class="grid g2"><div><label>Fornecedor / beneficiário</label><input id="pf" value="${esc(d.fornecedor||'')}"></div><div><label>Nº do documento</label><input id="pn" value="${esc(d.numero||'')}"></div>
   <div><label>Valor total (R$)</label><input id="pv" value="${d.valor_total??''}"></div><div><label>Emissão</label><input type="date" id="pe" value="${d.data_emissao||new Date().toISOString().slice(0,10)}"></div>
   <div><label>Vencimento</label><input type="date" id="pd" value="${(d.vencimentos?.[0]?.vencimento)||d.data_vencimento||''}"></div>
   <div><label>Categoria (DRE)</label><select id="pc">${cats.map(c=>`<option value="${c.id}" ${c.nome===sug?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div></div>
   ${d.vencimentos?.length>1?`<p class="d">${d.vencimentos.length} parcelas na nota: ${d.vencimentos.map(x=>x.vencimento+' '+R(x.valor)).join(' · ')} — serão lançadas separadas.</p>`:''}
   ${d.data_pagamento?`<p class="d">Comprovante com pagamento em ${d.data_pagamento}: será lançado como <b>quitado</b>.</p>`:''}
   ${itens.length?`<h4 style="margin-top:12px">Produtos da nota</h4>${tbl(['Descrição','Un','Qtd','Valor unit.','Total'],itens.map(i=>[esc(i.descricao),esc(i.unidade||''),i.quantidade,R(i.valor_unitario),R(i.valor_total)]))}<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="pest" checked style="width:auto"> Dar entrada destes produtos no estoque</label>`:''}
   <p id="perr" style="color:#ff8a6b"></p><button class="btn" id="plan">Lançar</button>`;
  $('#plan').onclick=async()=>{
    const cat=cats.find(c=>c.id===$('#pc').value);const forn=$('#pf').value.trim();const desc=`${forn||'Documento'}${$('#pn').value?' NF '+$('#pn').value:''}`;
    const parcelas=d.vencimentos?.length>1?d.vencimentos.map(x=>({v:x.valor,venc:x.vencimento})):[{v:num($('#pv').value),venc:$('#pd').value||null}];
    const pago=!!d.data_pagamento;
    const regs=parcelas.map((p,i)=>({empresa_id:S.emp,tipo:'pagar',descricao:desc+(parcelas.length>1?` (${i+1}/${parcelas.length})`:''),categoria:cat?.nome,grupo:cat?.grupo,categoria_id:cat?.id,valor:p.v,data:$('#pe').value,vencimento:p.venc,status:pago?'quitado':'aberto',beneficiario:forn,observacoes:'Lançado pelo leitor de documentos',parcela_num:i+1,parcelas_total:parcelas.length}));
    const {data:ls,error}=await sb.from('erp_lancamentos').insert(regs).select('id');
    if(error){$('#perr').textContent='Erro ao lançar: '+error.message;return}
    if(itens.length&&document.getElementById('pest')?.checked){
      for(const it of itens){
        const {data:ex}=await sb.from('estoque_itens').select('id,quantidade,custo_medio').eq('empresa_id',S.emp).ilike('descricao',it.descricao).maybeSingle();
        const qt=Number(it.quantidade)||0,cu=Number(it.valor_unitario)||0;let id=ex?.id;
        if(ex){const nq=Number(ex.quantidade)+qt;await sb.from('estoque_itens').update({quantidade:nq,custo_medio:nq?((Number(ex.quantidade)*Number(ex.custo_medio)+qt*cu)/nq):cu,atualizado_em:new Date().toISOString()}).eq('id',ex.id)}
        else{const {data:n}=await sb.from('estoque_itens').insert({empresa_id:S.emp,sku:it.codigo,descricao:it.descricao,unidade:it.unidade||'UN',quantidade:qt,custo_medio:cu}).select('id').single();id=n?.id}
        if(id)await sb.from('estoque_movs').insert({empresa_id:S.emp,item_id:id,tipo:'entrada',quantidade:qt,custo_unit:cu,documento_id:docId,criado_por:S.user.email});
      }
    }
    if(docId)await sb.from('documentos').update({status:'lancado',dados:d,lancamento_ids:(ls||[]).map(x=>x.id)}).eq('id',docId);
    $('#dprev').innerHTML=`<p style="color:#3FA7BA"><b>Lançado.</b> ${regs.length} lançamento(s) no financeiro${itens.length?' e estoque atualizado':''}.</p>`;
    setTimeout(()=>render(),1500);
  };
}

/* ---------- conciliação bancária ---------- */
function lerExtrato(txt){
  const out=[];
  if(/<STMTTRN>/i.test(txt)){
    txt.split(/<STMTTRN>/i).slice(1).forEach(b=>{const g=t=>(b.match(new RegExp('<'+t+'>([^<\\r\\n]*)','i'))||[])[1]?.trim();const d=g('DTPOSTED');if(!d)return;
      out.push({data:`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,valor:Number((g('TRNAMT')||'0').replace(',','.')),descricao:g('MEMO')||g('NAME')||'',fitid:g('FITID')||null})});
  }else{
    txt.split(/\r?\n/).forEach(l=>{const p=l.split(/[;\t]/);if(p.length<3)return;const m=p[0].match(/(\d{2})\/(\d{2})\/(\d{4})/)||p[0].match(/(\d{4})-(\d{2})-(\d{2})/);if(!m)return;
      const data=m[0].includes('/')?`${m[3]}-${m[2]}-${m[1]}`:m[0];out.push({data,descricao:p[1].trim(),valor:num(p[p.length-1]),fitid:null})});
  }
  return out;
}
PAGES.conciliacao=async v=>{
  if(pedirEmpresa(v))return;
  const [ext,lan,cats]=await Promise.all([q('extrato_bancario','id,data,descricao,valor,conciliado,lancamento_id',b=>b.order('data',{ascending:false}).limit(200)),
    q('erp_lancamentos','id,tipo,descricao,valor,vencimento,data,status,beneficiario',b=>b.neq('status','quitado').limit(500)),q('financeiro_categorias','id,nome,grupo,tipo',b=>b.eq('ativo',true).order('nome'))]);
  const pend=ext.filter(e=>!e.conciliado);
  const sugest=pend.map(e=>{const alvo=e.valor<0?'pagar':'receber';const dt=new Date(e.data).getTime();
    const l=lan.filter(x=>x.tipo===alvo&&Math.abs(Number(x.valor)-Math.abs(e.valor))<0.01).sort((a,b)=>Math.abs(new Date(a.vencimento||a.data)-dt)-Math.abs(new Date(b.vencimento||b.data)-dt))[0];
    return {e,l:l&&Math.abs(new Date(l.vencimento||l.data)-dt)<=6*864e5?l:null}});
  v.innerHTML=`<div class="card" style="max-width:760px"><h3>Importar extrato</h3><p class="d">Baixe o extrato no internet banking (OFX é o melhor; CSV com data;descrição;valor também serve) e envie aqui.</p>
   <input type="file" id="xf" accept=".ofx,.csv,.txt"><button class="btn" id="xgo" style="margin-top:10px">Importar</button> <span id="xm" class="d"></span></div>
   <div class="card" style="margin-top:16px"><h3>Pendentes de conciliação (${pend.length})</h3>${tbl(['Data','Descrição','Valor','Sugestão do sistema',''],sugest.map(({e,l},i)=>[D(e.data),esc(e.descricao),`<b style="color:${e.valor<0?'#ff8a6b':'#3FA7BA'}">${R(e.valor)}</b>`,l?`${esc(l.descricao)} · ${R(l.valor)}`:`<select class="xc" data-i="${i}"><option value="">Lançar como…</option>${cats.filter(c=>e.valor<0?c.tipo==='pagar':c.tipo==='receber').map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>`,l?`<button class="btn sm xok" data-i="${i}">Conciliar</button>`:`<button class="btn ghost sm xnv" data-i="${i}">Lançar</button>`]))}</div>`;
  $('#xgo').onclick=async()=>{const f=$('#xf').files[0];if(!f)return;const L=lerExtrato(await f.text());if(!L.length){$('#xm').textContent='Não encontrei lançamentos no arquivo.';return}
    const {error}=await sb.from('extrato_bancario').upsert(L.map(x=>({...x,empresa_id:S.emp})),{onConflict:'empresa_id,fitid',ignoreDuplicates:true});
    $('#xm').textContent=error?'Erro: '+error.message:L.length+' movimentos lidos.';if(!error)setTimeout(render,800)};
  v.onclick=async ev=>{const b=ev.target.closest('.xok,.xnv');if(!b)return;const {e,l}=sugest[+b.dataset.i];
    if(b.classList.contains('xok')){await sb.from('erp_lancamentos').update({status:'quitado'}).eq('id',l.id);await sb.from('extrato_bancario').update({conciliado:true,lancamento_id:l.id}).eq('id',e.id);render()}
    else{const cid=v.querySelector(`.xc[data-i="${b.dataset.i}"]`).value;if(!cid)return alert('Escolha a categoria.');const c=cats.find(x=>x.id===cid);
      const {data:n,error}=await sb.from('erp_lancamentos').insert({empresa_id:S.emp,tipo:e.valor<0?'pagar':'receber',descricao:e.descricao,categoria:c.nome,grupo:c.grupo,categoria_id:c.id,valor:Math.abs(e.valor),data:e.data,vencimento:e.data,status:'quitado',observacoes:'Lançado pela conciliação bancária'}).select('id').single();
      if(error)return alert(error.message);await sb.from('extrato_bancario').update({conciliado:true,lancamento_id:n.id}).eq('id',e.id);render()}};
};
PAGES.conciliacao.meta=['Conciliação bancária','Extrato do banco × contas lançadas'];

/* ---------- lotes de pagamento: só o administrador libera, com código ---------- */
PAGES.lotes=async v=>{
  if(pedirEmpresa(v))return;
  const {data:papel}=await sb.rpc('erp_papel');const adm=papel==='admin';
  const [lan0,lotes,cods,aud,emLote]=await Promise.all([
    q('erp_lancamentos','id,descricao,beneficiario,valor,vencimento,status',b=>b.eq('tipo','pagar').eq('status','aberto').order('vencimento').limit(200)),
    q('lotes_pagamento','id,descricao,total,status,criado_por,criado_em,liberado_por,liberado_em',b=>b.order('criado_em',{ascending:false}).limit(20)),
    adm?q('lote_codigos','lote_id,codigo'):Promise.resolve([]),
    adm?q('auditoria','acao,usuario,criado_em,detalhe',b=>b.order('criado_em',{ascending:false}).limit(15)):Promise.resolve([]),
    q('lote_itens','lancamento_id')]);
  const usados=new Set(emLote.map(x=>x.lancamento_id));const lan=lan0.filter(l=>!usados.has(l.id));
  v.innerHTML=`<div class="card"><h3>Contas a pagar em aberto</h3><p class="d">Marque as contas, crie o lote e o administrador libera com o código. Quem cria o lote não consegue liberar.</p>
   ${lan.length?`<div class="tw"><table><thead><tr><th></th><th>Beneficiário</th><th>Descrição</th><th>Vence</th><th>Valor</th></tr></thead><tbody>${lan.map(l=>`<tr><td><input type="checkbox" class="lk" value="${l.id}" style="width:auto"></td><td>${esc(l.beneficiario||'')}</td><td>${esc(l.descricao)}</td><td>${D(l.vencimento)}</td><td>${R(l.valor)}</td></tr>`).join('')}</tbody></table></div><input id="ld" placeholder="Descrição do lote (ex.: fornecedores semana 41)" style="margin-top:10px"><button class="btn" id="lgo" style="margin-top:8px">Criar lote para liberação</button> <span id="lm" class="d"></span>`:empty('Nenhuma conta a pagar em aberto.')}</div>
   <div class="card" style="margin-top:16px"><h3>Lotes</h3>${lotes.length?lotes.map(l=>{const c=cods.find(x=>x.lote_id===l.id);return `<div class="kc" style="margin-bottom:8px"><b>${esc(l.descricao||'Lote')} · ${R(l.total)}</b> ${stPill(l.status==='liberado'?'liberado':'aguardando')}<span>Criado por ${esc(l.criado_por||'')} em ${DT(l.criado_em)}${l.liberado_em?` · liberado por ${esc(l.liberado_por)} em ${DT(l.liberado_em)}`:''}</span>
     ${l.status==='aguardando_liberacao'?(adm?`<div style="margin-top:8px">Código do lote: <b style="font-size:18px;letter-spacing:3px">${esc(c?.codigo||'—')}</b><br><input class="lc" data-l="${l.id}" placeholder="Digite o código para liberar" style="width:210px"> <button class="btn sm lb" data-l="${l.id}">Liberar pagamento</button></div>`:'<span>Aguardando o administrador liberar.</span>'):''}</div>`}).join(''):empty('Nenhum lote ainda.')}</div>
   ${adm?`<div class="card" style="margin-top:16px"><h3>Registro de auditoria</h3>${tbl(['Quando','Quem','Ação'],aud.map(a=>[DT(a.criado_em),esc(a.usuario),esc(a.acao.replace(/_/g,' '))]))}</div>`:''}`;
  if(lan.length)$('#lgo').onclick=async()=>{const ids=[...v.querySelectorAll('.lk:checked')].map(x=>x.value);if(!ids.length){$('#lm').textContent='Marque ao menos uma conta.';return}
    const {data:r,error}=await sb.rpc('lote_criar',{p_empresa:S.emp,p_desc:$('#ld').value||'Lote de pagamento',p_lancs:ids});
    if(error||!r?.ok)$('#lm').textContent=error?.message||r.erro;else render()};
  v.onclick=async e=>{const b=e.target.closest('.lb');if(!b)return;const code=v.querySelector(`.lc[data-l="${b.dataset.l}"]`).value.trim();
    const {data:r,error}=await sb.rpc('lote_liberar',{p_lote:b.dataset.l,p_codigo:code});
    if(error||!r?.ok)alert(error?.message||r.erro);else render()};
};
PAGES.lotes.meta=['Pagamento em lote','Criação pelo financeiro · liberação só pelo administrador, com código e registro'];
