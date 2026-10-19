/* ---------- Produção (kanban editável) e Estoque ---------- */
const PROD_ST=[['aguardando','Aguardando'],['em_producao','Em produção'],['pronto','Pronto'],['enviado','Enviado'],['entregue','Entregue']];
const PROD_EDIT=['aguardando','em_producao','pronto']; // enviado/entregue mudam pelo Fluxo do pedido (exige NF, motorista…)
const prodLbl=s=>(PROD_ST.find(x=>x[0]===s)||[s,s||'sem status'])[1];

async function mudarProducao(p,para){
  const {error}=await sb.from('solarium_pedidos').update({status_producao:para}).eq('id',p.id);
  if(error)return error.message;
  await sb.from('pedido_fluxo_log').insert({empresa_id:p.empresa_id,pedido_id:p.id,de:'produção: '+prodLbl(p.status_producao),para:'produção: '+prodLbl(para),agente:'producao',usuario:S.user?.email||null});
  p.status_producao=para;return null;
}

PAGES.producao=async v=>{
  const d=await q('solarium_pedidos','id,empresa_id,numero_pedido,cliente_nome,fornecedor,status_producao,data_entrega_prevista,valor_total,etapa_fluxo',b=>b.eq('status','aprovado').order('data_entrega_prevista',{ascending:true,nullsFirst:false}).limit(400));
  const hoje=new Date().toISOString().slice(0,10);
  const desenhar=()=>{
    const por={};d.forEach(p=>{const k=PROD_ST.some(s=>s[0]===p.status_producao)?p.status_producao:'aguardando';(por[k]=por[k]||[]).push(p)});
    v.innerHTML=`<p class="d" style="margin-bottom:10px">Arraste entre <b>Aguardando</b>, <b>Em produção</b> e <b>Pronto</b>. Enviado e Entregue mudam pelo <b>Fluxo do pedido</b> (nota fiscal, motorista, comprovante). Data em vermelho = entrega atrasada.</p>
     <div class="kan">${PROD_ST.map(([k,l])=>{let C=por[k]||[];const tot=C.length;if(k==='entregue')C=C.slice(-10);
      return `<div class="col" data-st="${k}"><h4>${l}<span>${tot}</span></h4>${C.map(p=>{const atras=p.data_entrega_prevista&&p.data_entrega_prevista<hoje&&!['enviado','entregue'].includes(k);
        return `<div class="kc" ${PROD_EDIT.includes(k)?'draggable="true" style="cursor:grab"':'style="cursor:pointer"'} data-pd="${p.id}"><b>${esc(p.numero_pedido)} · ${esc(p.cliente_nome)}</b><span>${esc(p.fornecedor||'fornecedor a definir')}</span><span style="${atras?'color:var(--bad)':''}">entrega ${D(p.data_entrega_prevista)}</span></div>`}).join('')||'<div class="d" style="opacity:.5">vazio</div>'}</div>`}).join('')}</div>`;
  };
  desenhar();
  v.onclick=e=>{const c=e.target.closest('[data-pd]');if(c)fichaProducao(d.find(p=>p.id===c.dataset.pd),desenhar)};
  v.ondragstart=e=>{const c=e.target.closest('[data-pd]');if(c)e.dataTransfer.setData('text/plain',c.dataset.pd)};
  v.ondragover=e=>{const col=e.target.closest('[data-st]');if(col&&PROD_EDIT.includes(col.dataset.st))e.preventDefault()};
  v.ondrop=async e=>{
    const col=e.target.closest('[data-st]');const p=d.find(x=>x.id===e.dataTransfer.getData('text/plain'));
    if(!col||!p||!PROD_EDIT.includes(col.dataset.st)||p.status_producao===col.dataset.st)return;e.preventDefault();
    const err=await mudarProducao(p,col.dataset.st);if(err)alert('Erro: '+err);desenhar();
  };
};
PAGES.producao.meta=['Produção','Kanban de pedidos por etapa (prazo médio 45 dias)'];

async function fichaProducao(p,depois){
  const {data:itens}=await sb.from('solarium_pedido_itens').select('descricao,quantidade').eq('pedido_id',p.id).order('ordem');
  const pode=PROD_EDIT.includes(p.status_producao||'aguardando');
  modal(`<h3>${esc(p.numero_pedido)} · ${esc(p.cliente_nome)}</h3>
   <p class="d">${esc(p.fornecedor||'Fornecedor a definir')} · ${R(p.valor_total)} · entrega prevista ${D(p.data_entrega_prevista)} · etapa do fluxo: ${esc(p.etapa_fluxo||'—')}</p>
   <h4 style="margin-top:12px">Itens</h4>${(itens||[]).map(i=>`<div class="d">${Number(i.quantidade)}× ${esc(i.descricao)}</div>`).join('')||'<div class="d">Sem itens cadastrados.</div>'}
   ${pode?`<label style="margin-top:12px">Etapa da produção</label><select id="pr_st">${PROD_EDIT.map(k=>`<option value="${k}" ${(p.status_producao||'aguardando')===k?'selected':''}>${prodLbl(k)}</option>`).join('')}</select>
   <p id="pr_err" style="color:#ff8a6b"></p><button class="btn" id="pr_ok">Salvar</button>`:'<p class="d" style="margin-top:12px">Este pedido já saiu da produção; acompanhe pelo Fluxo do pedido.</p>'}`);
  if(pode)$('#pr_ok').onclick=async()=>{
    const para=$('#pr_st').value;if(para===p.status_producao){$('#modal').classList.add('hidden');return}
    const err=await mudarProducao(p,para);if(err){$('#pr_err').textContent='Erro: '+err;return}
    $('#modal').classList.add('hidden');depois();
  };
}

/* ---- Estoque ---- */
PAGES.estoque=async v=>{
  if(S.emp==='all'){v.innerHTML=empty('Escolha uma empresa no topo da tela para abrir o estoque.');return}
  const [it,mv]=await Promise.all([
    q('estoque_itens','id,empresa_id,sku,descricao,unidade,quantidade,custo_medio,preco_venda',b=>b.order('descricao')),
    q('estoque_movs','tipo,quantidade,custo_unit,criado_em,criado_por,observacao,item_id,pedido_id',b=>b.order('criado_em',{ascending:false}).limit(40))
  ]);
  $('#tools').innerHTML=`<button class="btn" id="esNovo">+ Novo item</button>`;
  $('#esNovo').onclick=()=>fichaEstoque(null);
  const nome=id=>esc((it.find(i=>i.id===id)||{}).descricao||'—');
  v.innerHTML=`<div class="card"><h3>Itens em estoque</h3>${tbl(['Código','Descrição','Un','Saldo','Custo médio','Valor em estoque',''],it.map(i=>[esc(i.sku||'—'),esc(i.descricao),esc(i.unidade||'UN'),
     `<b style="color:${Number(i.quantidade)<=0?'var(--bad)':'inherit'}">${Number(i.quantidade).toLocaleString('pt-BR')}</b>`,R(i.custo_medio),R(Math.max(0,i.quantidade)*i.custo_medio),`<button class="btn ghost sm" data-aj="${i.id}">Ajustar</button>`]))}
   <p class="d" style="margin-top:8px">Entradas: pelo leitor de notas (Documentos) ou ajuste manual. Saídas: automáticas quando o pedido é entregue — o item do pedido precisa ter o código entre colchetes no fim (ex.: "Almofada [ALM-35]") ou a mesma descrição do estoque. Saldo em vermelho = zerado ou negativo.</p></div>
   <div class="card" style="margin-top:16px"><h3>Últimas movimentações</h3>${tbl(['Quando','Item','Tipo','Qtd','Por','Obs.'],mv.map(m=>[DT(m.criado_em),nome(m.item_id),stPill(m.tipo),Number(m.quantidade).toLocaleString('pt-BR'),esc(m.criado_por||''),esc(m.observacao||'')]))}</div>`;
  v.onclick=e=>{const b=e.target.closest('[data-aj]');if(b)fichaEstoque(it.find(i=>i.id===b.dataset.aj))};
};
PAGES.estoque.meta=['Estoque','Saldo, custo e movimentações · baixa automática na entrega'];

function fichaEstoque(i){
  const num=id=>Number(String(document.getElementById(id)?.value||'').replace(/\./g,'').replace(',','.'))||0;
  if(!i){
    modal(`<h3>Novo item de estoque</h3><div class="grid g2"><div><label>Código (SKU)</label><input id="es_sku"></div><div><label>Unidade</label><input id="es_un" value="UN"></div></div>
     <label>Descrição</label><input id="es_d"><div class="grid g2"><div><label>Quantidade inicial</label><input id="es_q" inputmode="decimal" value="0"></div><div><label>Custo unitário (R$)</label><input id="es_c" inputmode="decimal" placeholder="0,00"></div></div>
     <p id="es_err" style="color:#ff8a6b"></p><button class="btn" id="es_ok">Cadastrar</button>`);
    $('#es_ok').onclick=async()=>{
      if(!$('#es_d').value.trim()){$('#es_err').textContent='Informe a descrição.';return}
      const qtd=num('es_q'),cu=num('es_c');
      const {data:n,error}=await sb.from('estoque_itens').insert({empresa_id:S.emp,sku:$('#es_sku').value.trim()||null,descricao:$('#es_d').value.trim(),unidade:$('#es_un').value.trim()||'UN',quantidade:qtd,custo_medio:cu}).select('id').single();
      if(error){$('#es_err').textContent='Erro: '+error.message;return}
      if(qtd)await sb.from('estoque_movs').insert({empresa_id:S.emp,item_id:n.id,tipo:'entrada',quantidade:qtd,custo_unit:cu,criado_por:S.user?.email||null,observacao:'Saldo inicial'});
      $('#modal').classList.add('hidden');render();
    };
    return;
  }
  modal(`<h3>Ajustar: ${esc(i.descricao)}</h3><p class="d">Saldo atual: <b>${Number(i.quantidade).toLocaleString('pt-BR')} ${esc(i.unidade||'UN')}</b> · custo médio ${R(i.custo_medio)}</p>
   <div class="grid g2"><div><label>Movimento</label><select id="es_t"><option value="entrada">Entrada (+)</option><option value="saida">Saída (−)</option></select></div><div><label>Quantidade</label><input id="es_q" inputmode="decimal"></div></div>
   <label>Custo unitário da entrada (R$, opcional — recalcula o custo médio)</label><input id="es_c" inputmode="decimal" placeholder="0,00">
   <label>Motivo</label><input id="es_m" placeholder="Ex.: contagem de inventário, avaria, devolução">
   <p id="es_err" style="color:#ff8a6b"></p><button class="btn" id="es_ok">Lançar ajuste</button>`);
  $('#es_ok').onclick=async()=>{
    const qtd=num('es_q'),cu=num('es_c'),tipo=$('#es_t').value;
    if(qtd<=0){$('#es_err').textContent='Informe a quantidade.';return}
    if(!$('#es_m').value.trim()){$('#es_err').textContent='Informe o motivo.';return}
    const saldo=Number(i.quantidade)+(tipo==='entrada'?qtd:-qtd);
    const custo=tipo==='entrada'&&cu&&saldo>0?((Math.max(0,Number(i.quantidade))*Number(i.custo_medio))+qtd*cu)/(Math.max(0,Number(i.quantidade))+qtd):Number(i.custo_medio);
    const {error}=await sb.from('estoque_movs').insert({empresa_id:i.empresa_id,item_id:i.id,tipo,quantidade:qtd,custo_unit:tipo==='entrada'&&cu?cu:i.custo_medio,criado_por:S.user?.email||null,observacao:'Ajuste manual: '+$('#es_m').value.trim()});
    if(error){$('#es_err').textContent='Erro: '+error.message;return}
    const r=await sb.from('estoque_itens').update({quantidade:saldo,custo_medio:Math.round(custo*100)/100,atualizado_em:new Date().toISOString()}).eq('id',i.id);
    if(r.error){$('#es_err').textContent='Movimento lançado, mas o saldo não atualizou: '+r.error.message;return}
    $('#modal').classList.add('hidden');render();
  };
}

if(typeof NAV!=='undefined'&&!NAV.some(g=>g[1].some(x=>x[0]==='estoque'))){
  const fin=NAV.find(g=>g[0]==='Financeiro');if(fin)fin[1].splice(1,0,['estoque','▥','Estoque']);
}
