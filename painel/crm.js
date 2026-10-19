/* ---------- CRM: clientes (ficha, pedidos, histórico) e funil de leads B2B ---------- */
const CT_TIPOS={varejo:'Varejo',atacado:'Atacado',arquiteto:'Arquiteto',representante:'Representante'};
const INT_TIPOS={whatsapp:'WhatsApp',ligacao:'Ligação',email:'E-mail',visita:'Visita',reuniao:'Reunião',nota:'Anotação'};
const LEAD_ST=[['novo','Novo'],['contatado','Contatado'],['em_conversa','Em conversa'],['proposta','Proposta enviada'],['ganho','Ganho'],['perdido','Perdido']];
const crmEmp=()=>S.emp==='all'?null:S.emp;
const precisaEmp=()=>{if(crmEmp())return false;modal('<h3>Escolha uma empresa</h3><p>Selecione a empresa no topo do menu para cadastrar ou editar.</p>');return true};
const zap=n=>{const d=String(n||'').replace(/\D/g,'');return d?`https://wa.me/${d.length<=11?'55'+d:d}`:''};
const val=id=>(document.getElementById(id)?.value||'').trim();
const optSel=(obj,v)=>Object.entries(obj).map(([k,l])=>`<option value="${k}" ${v===k?'selected':''}>${l}</option>`).join('');

async function crmHistorico(campo,id){
  const {data}=await sb.from('crm_interacoes').select('tipo,descricao,autor,criado_em').eq(campo,id).order('criado_em',{ascending:false}).limit(50);
  return (data||[]).map(i=>`<div class="d" style="padding:6px 0;border-bottom:1px solid var(--line,#ffffff14)"><b>${esc(INT_TIPOS[i.tipo]||i.tipo)}</b> · ${DT(i.criado_em)}${i.autor?' · '+esc(i.autor):''}<br>${esc(i.descricao)}</div>`).join('')||'<div class="d">Nenhuma interação registrada.</div>';
}
const crmFormInteracao=()=>`<div style="display:flex;gap:6px;margin-top:8px"><select id="ci_t" style="max-width:140px">${optSel(INT_TIPOS,'whatsapp')}</select><input id="ci_d" placeholder="O que foi conversado / combinado"><button class="btn sm" id="ci_ok">Registrar</button></div>`;
function crmLigarInteracao(alvo,emp,depois){
  $('#ci_ok').onclick=async()=>{
    if(!val('ci_d'))return;
    const {error}=await sb.from('crm_interacoes').insert({empresa_id:emp,...alvo,tipo:val('ci_t'),descricao:val('ci_d'),autor:S.user?.email||null});
    if(error)return alert('Erro: '+error.message);
    depois();
  };
}

/* ---- Clientes ---- */
let CRM={busca:'',tipo:'todos'};
PAGES.crm=async v=>{
  const d=await q('erp_contatos','id,empresa_id,nome,tipo,cidade,uf,whatsapp,telefone,email,documento,cep,instagram,origem,obs,criado_em',b=>b.order('criado_em',{ascending:false}).limit(1000));
  $('#tools').innerHTML=`<button class="btn" id="ctNovo">+ Novo cliente</button>`;
  $('#ctNovo').onclick=()=>fichaContato(null);
  const desenhar=()=>{
    const b=CRM.busca.toLowerCase();
    const L=d.filter(c=>(CRM.tipo==='todos'||c.tipo===CRM.tipo)&&(!b||[c.nome,c.cidade,c.whatsapp,c.telefone,c.email,c.instagram].some(x=>String(x||'').toLowerCase().includes(b))));
    $('#ctLista').innerHTML=tbl(['Nome','Tipo','Cidade','WhatsApp','Instagram','Origem'],L.slice(0,200).map(c=>[`<a href="#" data-ct="${c.id}"><b>${esc(c.nome)}</b></a>`,`<span class="pill tl">${esc(CT_TIPOS[c.tipo]||c.tipo||'—')}</span>`,esc([c.cidade,c.uf].filter(Boolean).join('/')),c.whatsapp||c.telefone?`<a href="${zap(c.whatsapp||c.telefone)}" target="_blank" rel="noopener">${esc(c.whatsapp||c.telefone)}</a>`:'',esc(c.instagram||''),esc(c.origem||'')]))
      +`<p class="d" style="margin-top:8px">${L.length} de ${d.length} contatos${L.length>200?' · mostrando os 200 mais recentes, refine a busca':''}</p>`;
  };
  v.innerHTML=`<div class="chips">${['todos',...Object.keys(CT_TIPOS)].map(t=>`<button class="chip ${CRM.tipo===t?'on':''}" data-t="${t}">${t==='todos'?'Todos':CT_TIPOS[t]}</button>`).join('')}<input id="ctBusca" placeholder="Buscar nome, cidade, telefone, e-mail…" value="${esc(CRM.busca)}" style="max-width:280px;margin-left:auto"></div>
   <div class="card" id="ctLista" style="margin-top:12px"></div>`;
  desenhar();
  $('#ctBusca').oninput=e=>{CRM.busca=e.target.value;desenhar()};
  v.onclick=e=>{
    const t=e.target.closest('[data-t]');if(t){CRM.tipo=t.dataset.t;render();return}
    const a=e.target.closest('[data-ct]');if(a){e.preventDefault();fichaContato(d.find(c=>c.id===a.dataset.ct))}
  };
};
PAGES.crm.meta=['Clientes e CRM','Ficha do cliente, pedidos e histórico de contato'];

async function fichaContato(c){
  if(!c&&precisaEmp())return;
  c=c||{};
  const campo=(id,l,k,extra='')=>`<div><label>${l}</label><input id="${id}" value="${esc(c[k]||'')}" ${extra}></div>`;
  const [pedidos,hist]=c.id?await Promise.all([
    sb.from('solarium_pedidos').select('numero_pedido,valor_total,etapa_fluxo,status_pagamento_cliente,criado_em').eq('cliente_contato_id',c.id).order('criado_em',{ascending:false}).limit(30).then(r=>r.data||[]),
    crmHistorico('contato_id',c.id)
  ]):[[],''];
  const totalComprado=pedidos.filter(p=>p.etapa_fluxo!=='orcamento_aberto').reduce((a,p)=>a+Number(p.valor_total||0),0);
  modal(`<h3>${c.id?esc(c.nome):'Novo cliente'}</h3>
   ${c.id?`<p class="d">${pedidos.length} pedido(s) · ${R(totalComprado)} comprados${c.whatsapp||c.telefone?` · <a href="${zap(c.whatsapp||c.telefone)}" target="_blank" rel="noopener">abrir WhatsApp</a>`:''}</p>`:''}
   <div class="grid g2">${campo('ct_n','Nome','nome')}<div><label>Tipo</label><select id="ct_t">${optSel(CT_TIPOS,c.tipo||'varejo')}</select></div>
   ${campo('ct_w','WhatsApp','whatsapp','inputmode="tel"')}${campo('ct_e','E-mail','email','type="email"')}
   ${campo('ct_d','CPF / CNPJ','documento')}${campo('ct_i','Instagram','instagram')}
   ${campo('ct_c','Cidade','cidade')}${campo('ct_u','UF','uf','maxlength="2"')}
   ${campo('ct_cep','CEP','cep')}${campo('ct_o','Origem (site, indicação, loja…)','origem')}</div>
   <label>Observações</label><textarea id="ct_obs" rows="2">${esc(c.obs||'')}</textarea>
   <p id="ct_err" style="color:#ff8a6b"></p><button class="btn" id="ct_ok">${c.id?'Salvar alterações':'Cadastrar cliente'}</button>
   ${c.id?`<h4 style="margin-top:16px">Pedidos</h4>${pedidos.length?tbl(['Nº','Valor','Etapa','Pagamento','Data'],pedidos.map(p=>[esc(p.numero_pedido),R(p.valor_total),stPill(p.etapa_fluxo),stPill(p.status_pagamento_cliente),D(p.criado_em)])):'<div class="d">Nenhum pedido ligado a este cliente.</div>'}
   <h4 style="margin-top:16px">Histórico de contato</h4>${crmFormInteracao()}<div id="ci_lista" style="margin-top:8px">${hist}</div>`:''}`);
  $('#ct_ok').onclick=async()=>{
    if(!val('ct_n')){$('#ct_err').textContent='Informe o nome.';return}
    const dados={nome:val('ct_n'),tipo:val('ct_t'),whatsapp:val('ct_w')||null,email:val('ct_e')||null,documento:val('ct_d')||null,instagram:val('ct_i')||null,
      cidade:val('ct_c')||null,uf:val('ct_u').toUpperCase()||null,cep:val('ct_cep')||null,origem:val('ct_o')||null,obs:val('ct_obs')||null};
    const r=c.id?await sb.from('erp_contatos').update(dados).eq('id',c.id):await sb.from('erp_contatos').insert({...dados,empresa_id:crmEmp()});
    if(r.error){$('#ct_err').textContent='Erro: '+r.error.message;return}
    $('#modal').classList.add('hidden');render();
  };
  if(c.id)crmLigarInteracao({contato_id:c.id},c.empresa_id,async()=>{$('#ci_d').value='';$('#ci_lista').innerHTML=await crmHistorico('contato_id',c.id)});
}

/* ---- Leads B2B (funil) ---- */
let LD={busca:''};
PAGES.leads=async v=>{
  const d=await q('leads_b2b','id,empresa_id,nome,segmento,cidade_uf,status,proximo_passo,proxima_acao_em,whatsapp,instagram,email,site,origem,observacoes,contato_id,criado_em',b=>b.order('criado_em',{ascending:false}).limit(1000));
  $('#tools').innerHTML=`<input id="ldBusca" placeholder="Buscar lead…" value="${esc(LD.busca)}" style="max-width:200px"> <button class="btn" id="ldNovo">+ Novo lead</button>`;
  $('#ldNovo').onclick=()=>fichaLead(null);
  const hoje=new Date().toISOString().slice(0,10);
  const desenhar=()=>{
    const b=LD.busca.toLowerCase();
    const L=d.filter(l=>!b||[l.nome,l.segmento,l.cidade_uf].some(x=>String(x||'').toLowerCase().includes(b)));
    const por={};L.forEach(l=>(por[LEAD_ST.some(s=>s[0]===l.status)?l.status:'novo']=por[LEAD_ST.some(s=>s[0]===l.status)?l.status:'novo']||[]).push(l));
    v.innerHTML=`<p class="d" style="margin-bottom:10px">Arraste o card para mudar a etapa. Clique para abrir a ficha. Próxima ação em vermelho = atrasada.</p>
     <div class="kan">${LEAD_ST.map(([k,lbl])=>{const C=por[k]||[];return `<div class="col" data-st="${k}"><h4>${lbl}<span>${C.length}</span></h4>${C.map(l=>{const atras=l.proxima_acao_em&&l.proxima_acao_em<hoje&&!['ganho','perdido'].includes(k);
      return `<div class="kc" draggable="true" data-ld="${l.id}" style="cursor:grab"><b>${esc(l.nome)}</b><span>${esc([l.segmento,l.cidade_uf].filter(Boolean).join(' · '))}</span>${l.proximo_passo||l.proxima_acao_em?`<span style="${atras?'color:var(--bad)':''}">${esc(l.proximo_passo||'')} ${l.proxima_acao_em?'· '+D(l.proxima_acao_em):''}</span>`:''}</div>`}).join('')||'<div class="d" style="opacity:.5">vazio</div>'}</div>`}).join('')}</div>`;
  };
  desenhar();
  $('#ldBusca').oninput=e=>{LD.busca=e.target.value;desenhar()};
  v.onclick=e=>{const c=e.target.closest('[data-ld]');if(c)fichaLead(d.find(l=>l.id===c.dataset.ld))};
  v.ondragstart=e=>{const c=e.target.closest('[data-ld]');if(c)e.dataTransfer.setData('text/plain',c.dataset.ld)};
  v.ondragover=e=>{if(e.target.closest('[data-st]'))e.preventDefault()};
  v.ondrop=async e=>{
    const col=e.target.closest('[data-st]');const id=e.dataTransfer.getData('text/plain');if(!col||!id)return;e.preventDefault();
    const l=d.find(x=>x.id===id);if(!l||l.status===col.dataset.st)return;
    const de=l.status;l.status=col.dataset.st;desenhar();
    const {error}=await sb.from('leads_b2b').update({status:l.status}).eq('id',id);
    if(error){l.status=de;desenhar();alert('Erro: '+error.message);return}
    await sb.from('crm_interacoes').insert({empresa_id:l.empresa_id,lead_id:id,tipo:'nota',descricao:`Etapa: ${LEAD_ST.find(s=>s[0]===de)?.[1]||de} → ${LEAD_ST.find(s=>s[0]===l.status)[1]}`,autor:S.user?.email||null});
  };
};
PAGES.leads.meta=['Leads B2B','Funil de arquitetos, lojas e parceiros'];

async function fichaLead(l){
  if(!l&&precisaEmp())return;
  l=l||{status:'novo'};
  const campo=(id,lbl,k,extra='')=>`<div><label>${lbl}</label><input id="${id}" value="${esc(l[k]||'')}" ${extra}></div>`;
  const hist=l.id?await crmHistorico('lead_id',l.id):'';
  modal(`<h3>${l.id?esc(l.nome):'Novo lead'}</h3>
   ${l.contato_id?'<p class="d"><span class="pill ok">já é cliente</span> — veja a ficha em Clientes e CRM</p>':''}
   <div class="grid g2">${campo('ld_n','Nome / empresa','nome')}${campo('ld_s','Segmento (arquiteto, loja, hotel…)','segmento')}
   ${campo('ld_c','Cidade/UF','cidade_uf')}<div><label>Etapa</label><select id="ld_st">${optSel(Object.fromEntries(LEAD_ST),l.status)}</select></div>
   ${campo('ld_w','WhatsApp','whatsapp','inputmode="tel"')}${campo('ld_e','E-mail','email','type="email"')}
   ${campo('ld_i','Instagram','instagram')}${campo('ld_site','Site','site')}
   ${campo('ld_pp','Próximo passo','proximo_passo')}<div><label>Quando</label><input id="ld_pd" type="date" value="${esc(l.proxima_acao_em||'')}"></div></div>
   <label>Observações</label><textarea id="ld_obs" rows="2">${esc(l.observacoes||'')}</textarea>
   <p id="ld_err" style="color:#ff8a6b"></p>
   <button class="btn" id="ld_ok">${l.id?'Salvar':'Cadastrar lead'}</button>
   ${l.id&&!l.contato_id?' <button class="btn ghost" id="ld_conv">Converter em cliente</button>':''}
   ${l.whatsapp?` <a class="btn ghost" href="${zap(l.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>`:''}
   ${l.id?`<h4 style="margin-top:16px">Histórico de contato</h4>${crmFormInteracao()}<div id="ci_lista" style="margin-top:8px">${hist}</div>`:''}`);
  const dados=()=>({nome:val('ld_n'),segmento:val('ld_s')||null,cidade_uf:val('ld_c')||null,status:val('ld_st'),whatsapp:val('ld_w')||null,email:val('ld_e')||null,
    instagram:val('ld_i')||null,site:val('ld_site')||null,proximo_passo:val('ld_pp')||null,proxima_acao_em:val('ld_pd')||null,observacoes:val('ld_obs')||null});
  $('#ld_ok').onclick=async()=>{
    if(!val('ld_n')){$('#ld_err').textContent='Informe o nome.';return}
    const r=l.id?await sb.from('leads_b2b').update(dados()).eq('id',l.id):await sb.from('leads_b2b').insert({...dados(),empresa_id:crmEmp(),origem:'manual'});
    if(r.error){$('#ld_err').textContent='Erro: '+r.error.message;return}
    $('#modal').classList.add('hidden');render();
  };
  if(l.id&&!l.contato_id)$('#ld_conv').onclick=async()=>{
    const x=dados();if(!x.nome){$('#ld_err').textContent='Informe o nome.';return}
    const [cidade,uf]=String(x.cidade_uf||'').split(/[\/\-]/).map(s=>s&&s.trim());
    const {data:ct,error}=await sb.from('erp_contatos').insert({empresa_id:l.empresa_id,nome:x.nome,tipo:/arquit/i.test(x.segmento||'')?'arquiteto':'atacado',
      whatsapp:x.whatsapp,email:x.email,instagram:x.instagram,cidade:cidade||null,uf:uf&&uf.length===2?uf.toUpperCase():null,origem:'lead B2B',obs:x.observacoes}).select('id').single();
    if(error){$('#ld_err').textContent='Erro: '+error.message;return}
    const r=await sb.from('leads_b2b').update({...x,status:'ganho',contato_id:ct.id}).eq('id',l.id);
    if(r.error){$('#ld_err').textContent='Cliente criado, mas o lead não foi atualizado: '+r.error.message;return}
    await sb.from('crm_interacoes').insert({empresa_id:l.empresa_id,lead_id:l.id,contato_id:ct.id,tipo:'nota',descricao:'Lead convertido em cliente',autor:S.user?.email||null});
    $('#modal').classList.add('hidden');render();
  };
  if(l.id)crmLigarInteracao({lead_id:l.id},l.empresa_id,async()=>{$('#ci_d').value='';$('#ci_lista').innerHTML=await crmHistorico('lead_id',l.id)});
}
