/* ---------- Programa de afiliados (Seja parceiro da Trama) ---------- */
const AF_ST={cadastro:'Novo cadastro',em_analise:'Em análise',aprovado_atendimento:'Aguardando aprovação final',aprovado:'Ativo',suspenso:'Suspenso',recusado:'Recusado',bloqueado:'Bloqueado',excluido:'Excluído'};
const afPill=s=>{const c=s==='aprovado'?'ok':['recusado','bloqueado','excluido'].includes(s)?'bad':'warn';return `<span class="pill ${c}">${esc(AF_ST[s]||s)}</span>`};
const afNum=x=>{const n=parseFloat(String(x||'0').replace(/\./g,'').replace(',','.'));return isNaN(n)?0:n};

PAGES.afiliados=async v=>{
  if(pedirEmpresa(v))return;
  const [af,com,par,atr]=await Promise.all([
    q('afiliados','id,codigo,tipo,nome,documento,razao_social,email,telefone,endereco,redes,chave_pix,status,motivo_recusa,regime_fiscal,criado_em,aprovado_em,doc_frente_path,selfie_path,comprovante_endereco_path,contrato_aceite_em,contrato_versao,aceita_ofertas_futuras,docs_apagar',b=>b.order('criado_em',{ascending:false})),
    q('afiliado_comissoes','id,afiliado_id,pedido_id,valor_base,percentual,valor,status,liberar_em,criado_em',b=>b.order('criado_em',{ascending:false}).limit(200)),
    q('afiliado_comissao_parcelas','id,comissao_id,afiliado_id,valor,liberar_em,status',b=>b.in('status',['reservada','liberada']).order('liberar_em')),
    q('afiliado_atribuicoes','id,afiliado_id,reference_id,valor_produtos,suspeita_autocompra,status,criado_em',b=>b.order('criado_em',{ascending:false}).limit(100))
  ]);
  const {data:papel}=await sb.rpc('erp_papel');const adm=papel==='admin';
  const nm=id=>esc((af.find(a=>a.id===id)||{}).nome||'—');
  const pend=af.filter(a=>['cadastro','em_analise','aprovado_atendimento'].includes(a.status));
  const reservado=par.reduce((s,p)=>s+Number(p.valor),0);
  const hoje=new Date().toISOString().slice(0,10);
  const liberadas=par.filter(p=>p.liberar_em<=hoje);
  const atrPend=atr.filter(a=>a.status==='pendente');
  v.innerHTML=`
  <div class="grid g4">
   <div class="card"><div class="d">Parceiros ativos</div><h2>${af.filter(a=>a.status==='aprovado').length}</h2></div>
   <div class="card"><div class="d">Aguardando análise</div><h2>${pend.length}</h2></div>
   <div class="card"><div class="d">Comissões reservadas</div><h2>${R(reservado)}</h2></div>
   <div class="card"><div class="d">Prontas para pagar</div><h2>${R(liberadas.reduce((s,p)=>s+Number(p.valor),0))}</h2></div>
  </div>
  <div class="card" style="margin-top:12px"><h3>Cadastros para analisar</h3>
   <p class="d">Fluxo: 1) atendimento confere documentos, selfie e comprovante → 2) aprovação final do administrador. Só então o link do parceiro passa a valer.</p>
   ${tbl(['Parceiro','Tipo','Contato','Situação','Ações'],pend.map(a=>[`<b>${esc(a.nome)}</b><br><span class="d">${esc(a.documento||'')}</span>`,a.tipo==='pj'?'PJ':'PF',`${esc(a.email||'')}<br>${esc(a.telefone||'')}`,afPill(a.status),`<button class="btn sm" data-ver="${a.id}">Conferir</button>`]))}</div>
  <div class="card" style="margin-top:12px"><h3>Vendas indicadas aguardando confirmação</h3>
   <p class="d">A venda só vira comissão depois de confirmada com pedido realmente pago. Compras suspeitas de serem do próprio parceiro exigem revisão manual.</p>
   ${tbl(['Pedido','Parceiro','Valor dos produtos','Alerta','Ação'],atrPend.map(t=>[esc(t.reference_id),nm(t.afiliado_id),R(t.valor_produtos),t.suspeita_autocompra?'<span class="pill bad">possível autocompra</span>':'—',`<button class="btn sm" data-conf="${t.id}">Confirmar</button>`]))}</div>
  <div class="card" style="margin-top:12px"><h3>Pagamentos (quinzenal: dias 1 e 16)</h3>
   <p class="d">Libera 7 dias depois da entrega prevista. O dinheiro já está reservado; o pagamento tira da reserva.</p>
   ${tbl(['Parceiro','Valor bruto','Libera em','Situação','Ação'],par.map(p=>[nm(p.afiliado_id),R(p.valor),p.liberar_em?new Date(p.liberar_em+'T12:00').toLocaleDateString('pt-BR'):'—',p.liberar_em<=hoje?'<span class="pill ok">liberada</span>':'<span class="pill warn">reservada</span>',p.liberar_em<=hoje?`<button class="btn sm" data-pg="${p.id}">Registrar pagamento</button>`:'—']))}</div>
  <div class="card" style="margin-top:12px"><h3>Comissões</h3>
   ${tbl(['Parceiro','Base','%','Comissão','Situação','Ação'],com.map(c=>[nm(c.afiliado_id),R(c.valor_base),c.percentual+'%',R(c.valor),stPill(c.status),['cancelada','estornada'].includes(c.status)?'—':`<button class="btn sm" data-can="${c.id}">Pedido cancelado</button>`]))}</div>
  <div class="card" style="margin-top:12px"><h3>Todos os parceiros</h3>
   ${tbl(['Parceiro','Código','Situação','Desde','Ações'],af.map(a=>[esc(a.nome),esc(a.codigo||'—'),afPill(a.status),D(a.criado_em),a.status==='aprovado'?`<button class="btn sm" data-sus="${a.id}">Suspender</button>`:a.status==='suspenso'&&adm?`<button class="btn sm" data-rea="${a.id}">Reativar</button>`:`<button class="btn sm" data-ver="${a.id}">Ver</button>`]))}</div>`;

  const acao=async(id,ac,motivo)=>{const {error}=await sb.rpc('afiliado_analisar',{p_id:id,p_acao:ac,p_motivo:motivo||null});if(error)alert('Erro: '+error.message);else render()};
  v.querySelectorAll('[data-sus]').forEach(b=>b.onclick=()=>{const m=prompt('Motivo da suspensão:');if(m!==null)acao(b.dataset.sus,'suspender',m)});
  v.querySelectorAll('[data-rea]').forEach(b=>b.onclick=()=>acao(b.dataset.rea,'reativar'));
  v.querySelectorAll('[data-can]').forEach(b=>b.onclick=async()=>{const m=prompt('Motivo do cancelamento/devolução do pedido:');if(m===null)return;const {data,error}=await sb.rpc('afiliado_cancelar_comissao',{p_comissao:b.dataset.can,p_motivo:m});if(error)alert('Erro: '+error.message);else{if(data&&data.ja_pago>0)alert('A comissão já tinha sido paga: foi lançado saldo negativo para o parceiro.');render()}});
  v.querySelectorAll('[data-conf]').forEach(b=>b.onclick=async()=>{
    const t=atr.find(x=>x.id===b.dataset.conf);
    const ped=prompt('Número do pedido (UUID interno) pago para vincular — ou deixe em branco para cancelar:');if(!ped)return;
    const ent=prompt('Data prevista de entrega (AAAA-MM-DD):',new Date(Date.now()+45*864e5).toISOString().slice(0,10));if(!ent)return;
    const val=prompt('Valor dos PRODUTOS pagos (sem frete):',String(t.valor_produtos).replace('.',','));if(!val)return;
    const {data,error}=await sb.rpc('afiliado_confirmar_comissao',{p_reference_id:t.reference_id,p_pedido_id:ped,p_valor_base:afNum(val),p_entrega_prevista:ent});
    if(error)alert('Erro: '+error.message);else{alert('Comissão de '+R(data.comissao)+' ('+data.percentual+'%) reservada. Libera em '+data.liberar_em+'.');render()}});
  v.querySelectorAll('[data-pg]').forEach(b=>b.onclick=async()=>{
    const p=par.find(x=>x.id===b.dataset.pg);const a=af.find(x=>x.id===p.afiliado_id)||{};
    const pf=a.tipo!=='pj';
    const dica=pf?'Parceiro PF: informe INSS e IRRF conforme a tabela vigente (o contador valida). Emitir RPA.':'Parceiro PJ: exigir NFS-e antes de pagar.';
    const irrf=prompt(dica+'\nIRRF retido (R$):','0');if(irrf===null)return;
    const inss=prompt('INSS retido (R$):','0');if(inss===null)return;
    const doc=prompt('Documento fiscal (RPA ou NFS-e) — número:','');if(doc===null)return;
    const {data,error}=await sb.rpc('afiliado_registrar_pagamento',{p_parcela:p.id,p_irrf:afNum(irrf),p_inss:afNum(inss),p_iss:0,p_outras:0,p_doc_tipo:pf?'rpa':'nfse',p_doc_numero:doc||null,p_obs:null});
    if(error)alert('Erro: '+error.message);else{alert('Registrado. Líquido: '+R(data.liquido)+'. Faça o Pix para '+(a.chave_pix||'a chave cadastrada')+'.');render()}});
  v.querySelectorAll('[data-ver]').forEach(b=>b.onclick=()=>afFicha(af.find(x=>x.id===b.dataset.ver),adm,acao));
};
PAGES.afiliados.meta=['Afiliados','Programa Seja parceiro da Trama: cadastros, comissões e pagamentos'];

async function afFicha(a,adm,acao){
  const sign=async p=>{if(!p)return '';const {data}=await sb.storage.from('afiliados-docs').createSignedUrl(p,600);return data?data.signedUrl:''};
  const [d1,d2,d3]=await Promise.all([sign(a.doc_frente_path),sign(a.selfie_path),sign(a.comprovante_endereco_path)]);
  const lk=(u,t)=>u?`<a href="${u}" target="_blank" rel="noopener">${t}</a>`:`<span class="d">${t}: não enviado</span>`;
  const podeAt=['cadastro','em_analise'].includes(a.status);
  const podeFinal=a.status==='aprovado_atendimento'&&adm;
  modal(`<h3>${esc(a.nome)} ${afPill(a.status)}</h3>
   <p><b>${a.tipo==='pj'?'PJ':'PF'}</b> · ${esc(a.documento||'')} ${a.razao_social?'· '+esc(a.razao_social):''}<br>${esc(a.email||'')} · ${esc(a.telefone||'')}<br>Regime: ${esc(a.regime_fiscal||'—')}<br>Pix: ${esc(a.chave_pix||'—')}</p>
   <p class="d">Endereço: ${esc(typeof a.endereco==='string'?a.endereco:JSON.stringify(a.endereco||{}))}<br>Redes: ${esc(typeof a.redes==='string'?a.redes:JSON.stringify(a.redes||{}))}</p>
   <p>Documentos (links válidos por 10 min): ${lk(d1,'Documento com foto')} · ${lk(d2,'Selfie com documento')} · ${lk(d3,'Comprovante de endereço')}</p>
   <p class="d">Contrato ${esc(a.contrato_versao||'')} aceito em ${a.contrato_aceite_em?DT(a.contrato_aceite_em):'—'}. Ofertas futuras: ${a.aceita_ofertas_futuras?'sim':'não'}.</p>
   ${a.motivo_recusa?`<p class="d">Motivo registrado: ${esc(a.motivo_recusa)}</p>`:''}
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
    ${podeAt?'<button class="btn" id="afA">Documentos conferem (aprovar atendimento)</button>':''}
    ${podeFinal?'<button class="btn" id="afF">Aprovação final</button>':''}
    ${['cadastro','em_analise','aprovado_atendimento'].includes(a.status)?'<button class="btn sm" id="afR">Recusar</button>':''}
   </div>
   ${a.status==='aprovado_atendimento'&&!adm?'<p class="d">Falta a aprovação final do administrador.</p>':''}`);
  const go=(id,ac,ask)=>{const el=document.getElementById(id);if(el)el.onclick=()=>{let m=null;if(ask){m=prompt('Motivo:');if(m===null)return}$('#modal').classList.add('hidden');acao(a.id,ac,m)}};
  go('afA','atendimento_aprovar');go('afF','aprovar_final');go('afR','recusar',true);
}

if(typeof NAV!=='undefined'&&!NAV.some(g=>g[1].some(i=>i[0]==='afiliados'))){
  const mk=NAV.find(g=>g[0]==='Marketing');if(mk)mk[1].push(['afiliados','★','Afiliados']);
}
