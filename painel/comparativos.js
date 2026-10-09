/* LAR · Comparativos por setor: mês atual × mês anterior × mesmo mês do ano passado, com gráficos de 12 meses */
const ymOf=d=>String(d).slice(0,7);
const addM=(s,k)=>{const [y,m]=s.split('-').map(Number);const d=new Date(y,m-1+k,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const rotMes=s=>{const [y,m]=s.split('-');return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+m-1]+'/'+y.slice(2)};
const aggMes=(rows,dt,val=()=>1)=>{const m={};rows.forEach(r=>{const d=dt(r);if(!d)return;const k=ymOf(d);m[k]=(m[k]||0)+Number(val(r)||0)});return m};
const varPct=(a,b)=>b?((a-b)/b)*100:null;
const varTxt=v=>v==null?'—':(v>=0?'▲ ':'▼ ')+Math.abs(v).toFixed(1).replace('.',',')+'%';
const mesesAte=(sel,n=12)=>Array.from({length:n},(_,i)=>addM(sel,i-(n-1)));
const PAL=['#F57C20','#1F7A8C','#3FA7BA','#F5B820','#8FB0BD','#B05DE0'];
function kpiCmp(titulo,mp,sel,fmt,inv){
  const cur=mp[sel]||0,prev=mp[addM(sel,-1)]||0,ly=mp[addM(sel,-12)]||0;
  const vp=varPct(cur,prev),vl=varPct(cur,ly);
  const cor=v=>v==null?'var(--mut)':((v>=0)!==!!inv)?'#3FA7BA':'#ff8a6b';
  return `<div class="card kpi"><h3>${titulo}</h3><div class="v">${fmt(cur)}</div>
   <div class="d">Mês anterior: ${fmt(prev)} <b style="color:${cor(vp)}">${varTxt(vp)}</b></div>
   <div class="d">Ano passado (${rotMes(addM(sel,-12))}): ${ly?fmt(ly):'sem histórico'} <b style="color:${cor(vl)}">${varTxt(vl)}</b></div></div>`;
}
function graficoSerie(id,mp,sel,rotulo,fmt){
  const ms=mesesAte(sel);
  chart(id,{type:'bar',data:{labels:ms.map(rotMes),datasets:[{type:'bar',label:rotulo,data:ms.map(k=>mp[k]||0),backgroundColor:'#F57C20',borderRadius:6},
    {type:'line',label:'Mesmo mês do ano passado',data:ms.map(k=>mp[addM(k,-12)]??null),borderColor:'#3FA7BA',backgroundColor:'#3FA7BA',tension:.3,spanGaps:true,pointRadius:3}]},
    options:{plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmt(c.parsed.y)}}},scales:{x:{grid:{display:false}},y:{grid:{color:'#ffffff10'},ticks:{callback:v=>fmt(v)}}}}});
}
const blocoGrafico=(id,titulo)=>`<div class="card" style="margin-top:14px"><h3>${titulo}</h3><canvas id="${id}" height="110"></canvas></div>`;
const NUM=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:0});
const tabelaCmp=(titulo,linhas,sel,fmt)=>`<div class="card" style="margin-top:14px"><h3>${titulo}</h3>${tbl(['Item',rotMes(sel),rotMes(addM(sel,-1)),'Variação',rotMes(addM(sel,-12)),'Variação'],linhas.map(([n,mp,inv])=>{const c=mp[sel]||0,p=mp[addM(sel,-1)]||0,l=mp[addM(sel,-12)]||0;return [esc(n),fmt(c),fmt(p),varTxt(varPct(c,p)),l?fmt(l):'—',varTxt(varPct(c,l))]}))}</div>`;

PAGES.comparativos=async v=>{
  if(S.emp==='all'){v.innerHTML=empty('Escolha uma empresa no topo da tela para ver os comparativos.');return}
  S.cmpMes=S.cmpMes||new Date().toISOString().slice(0,7);S.cmpTab=S.cmpTab||'vendas';
  const sel=S.cmpMes;
  $('#tools').innerHTML=`<input type="month" id="cm" value="${sel}" style="width:auto">`;$('#cm').onchange=e=>{S.cmpMes=e.target.value;render()};
  const tabs=[['vendas','Vendas'],['compras','Compras'],['despesas','Despesas e resultado'],['pessoal','Pessoal'],['marketing','Marketing e redes']];
  let corpo='',pos=()=>{};
  const desde=addM(sel,-24)+'-01';
  if(S.cmpTab==='vendas'){
    const ped=await q('solarium_pedidos','valor_total,status,criado_em',b=>b.gte('criado_em',desde).neq('status','cancelado'));
    const fat=aggMes(ped.filter(p=>p.status==='aprovado'),p=>p.criado_em,p=>p.valor_total),qtd=aggMes(ped.filter(p=>p.status==='aprovado'),p=>p.criado_em),orc=aggMes(ped.filter(p=>p.status==='orcamento'),p=>p.criado_em);
    const tk={};Object.keys(fat).forEach(k=>tk[k]=qtd[k]?fat[k]/qtd[k]:0);
    corpo=`<div class="grid g4">${kpiCmp('Faturamento (pedidos aprovados)',fat,sel,R)}${kpiCmp('Pedidos fechados',qtd,sel,NUM)}${kpiCmp('Ticket médio',tk,sel,R)}${kpiCmp('Orçamentos abertos',orc,sel,NUM)}</div>${blocoGrafico('g1','Faturamento — últimos 12 meses × mesmo mês do ano passado')}${blocoGrafico('g2','Pedidos fechados por mês')}`;
    pos=()=>{graficoSerie('g1',fat,sel,'Faturamento',R);graficoSerie('g2',qtd,sel,'Pedidos',NUM)};
  }else if(S.cmpTab==='compras'){
    const c=await q('erp_compras','valor,data',b=>b.gte('data',desde));
    const val=aggMes(c,x=>x.data,x=>x.valor),qt=aggMes(c,x=>x.data);
    corpo=`<div class="grid g2">${kpiCmp('Compras (valor)',val,sel,R,true)}${kpiCmp('Pedidos de compra',qt,sel,NUM,true)}</div>${blocoGrafico('g1','Compras — últimos 12 meses × mesmo mês do ano passado')}`;
    pos=()=>graficoSerie('g1',val,sel,'Compras',R);
  }else if(S.cmpTab==='despesas'){
    const ms=[...new Set([...mesesAte(sel),...mesesAte(addM(sel,-12))])];
    const res=await Promise.all(ms.map(m=>sb.rpc('dre_mes',{p_empresa:S.emp,p_mes:m+'-01'})));
    const por={};ms.forEach((m,i)=>por[m]=(res[i].data||[]).map(r=>({...r,t:Number(r.manual)+Number(r.lancado)})));
    const GD=['deducoes','custo','pessoal','administrativas','comerciais','logistica','financeiras','impostos_lucro','sem_categoria'];
    const soma=(m,gs)=>(por[m]||[]).filter(r=>gs.includes(r.grupo)).reduce((a,r)=>a+r.t,0);
    const rec={},des={},resu={};ms.forEach(m=>{rec[m]=soma(m,['receita']);des[m]=soma(m,GD);resu[m]=rec[m]-des[m]});
    const GN=Object.fromEntries(GRUPOS);
    const gl=GD.map(g=>{const mp={};ms.forEach(m=>mp[m]=soma(m,[g]));return [GN[g]||g,mp]}).filter(([,mp])=>Object.values(mp).some(x=>x));
    corpo=`<div class="grid g3">${kpiCmp('Receita',rec,sel,R)}${kpiCmp('Despesas (todas)',des,sel,R,true)}${kpiCmp('Resultado',resu,sel,R)}</div>${blocoGrafico('g1','Despesas — últimos 12 meses × mesmo mês do ano passado')}${blocoGrafico('g2','Receita — últimos 12 meses × mesmo mês do ano passado')}${tabelaCmp('Despesas por grupo',gl,sel,R)}<p class="d" style="margin-top:8px">Inclui o que foi lançado no Financeiro e o preenchido na receita do bolo, sem a depreciação.</p>`;
    pos=()=>{graficoSerie('g1',des,sel,'Despesas',R);graficoSerie('g2',rec,sel,'Receita',R)};
  }else if(S.cmpTab==='pessoal'){
    const f=await q('erp_funcionarios','id,nome,funcao,setor,salario,admissao,demissao',b=>b.order('nome'));
    const ms=[...new Set([...mesesAte(sel),...mesesAte(addM(sel,-12))])];
    const fim=m=>addM(m,1)+'-01';
    const ativos={},folha={};ms.forEach(m=>{const a=f.filter(x=>x.admissao&&x.admissao<fim(m)&&(!x.demissao||x.demissao>=fim(m)));ativos[m]=a.length;folha[m]=a.reduce((s,x)=>s+Number(x.salario||0),0)});
    const cont=aggMes(f,x=>x.admissao),dem=aggMes(f,x=>x.demissao);
    corpo=`<div class="grid g4">${kpiCmp('Colaboradores ativos',ativos,sel,NUM)}${kpiCmp('Contratações',cont,sel,NUM)}${kpiCmp('Demissões',dem,sel,NUM,true)}${kpiCmp('Folha (salários)',folha,sel,R,true)}</div>${blocoGrafico('g1','Colaboradores ativos — 12 meses')}${blocoGrafico('g2','Folha de salários — 12 meses')}
     <div class="card" style="margin-top:14px"><h3>Equipe e datas</h3>${tbl(['Nome','Função','Setor','Salário','Admissão','Demissão'],f.map(x=>[esc(x.nome),esc(x.funcao||''),esc(x.setor||''),R(x.salario),`<input type="date" class="fa" data-id="${x.id}" value="${x.admissao||''}">`,`<input type="date" class="fd" data-id="${x.id}" value="${x.demissao||''}">`]))}<p class="d">As datas de admissão e demissão alimentam os gráficos de contratação e demissão.</p></div>`;
    pos=()=>{graficoSerie('g1',ativos,sel,'Ativos',NUM);graficoSerie('g2',folha,sel,'Folha',R);
      document.querySelectorAll('.fa,.fd').forEach(i=>i.onchange=async()=>{await sb.from('erp_funcionarios').update({[i.classList.contains('fa')?'admissao':'demissao']:i.value||null}).eq('id',i.dataset.id);render()})};
  }else{
    const [posts,pm,sm,ads]=await Promise.all([
      q('social_posts','id,redes,formato,publicado_em,status',b=>b.not('publicado_em','is',null).gte('publicado_em',desde)),
      q('social_posts_metricas','post_id,rede,curtidas,coletado_em',b=>b.gte('coletado_em',desde)),
      q('social_metricas','rede,seguidores,coletado_em',b=>b.gte('coletado_em',desde)),
      q('erp_lancamentos','valor,data,categoria',b=>b.eq('tipo','pagar').gte('data',desde.slice(0,10)).ilike('categoria','%anúncio%'))]);
    const fmtF=f=>/reel/i.test(f||'')?'Reels':/stor/i.test(f||'')?'Stories':/carrossel|carousel/i.test(f||'')?'Carrossel':'Feed';
    const total=aggMes(posts,p=>p.publicado_em);
    const porF={Feed:{},Reels:{},Stories:{},Carrossel:{}};Object.keys(porF).forEach(f=>porF[f]=aggMes(posts.filter(p=>fmtF(p.formato)===f),p=>p.publicado_em));
    const redes=[...new Set([...posts.flatMap(p=>p.redes||[]),...sm.map(s=>s.rede)])].filter(Boolean);
    const porR={};redes.forEach(r=>porR[r]=aggMes(posts.filter(p=>(p.redes||[]).includes(r)),p=>p.publicado_em));
    const mesPost=Object.fromEntries(posts.map(p=>[p.id,ymOf(p.publicado_em)]));
    const ult={};pm.forEach(x=>{const k=x.post_id+'|'+x.rede;if(!ult[k]||x.coletado_em>ult[k].coletado_em)ult[k]=x});
    const curt={};const curtR={};redes.forEach(r=>curtR[r]={});
    Object.values(ult).forEach(x=>{const m=mesPost[x.post_id];if(!m)return;curt[m]=(curt[m]||0)+x.curtidas;(curtR[x.rede]=curtR[x.rede]||{})[m]=((curtR[x.rede]||{})[m]||0)+x.curtidas});
    const seg={};const segR={};redes.forEach(r=>segR[r]={});
    const ord=[...sm].sort((a,b)=>a.coletado_em<b.coletado_em?-1:1);ord.forEach(x=>{(segR[x.rede]=segR[x.rede]||{})[ymOf(x.coletado_em)]=x.seguidores});
    mesesAte(sel,25).forEach(m=>{seg[m]=redes.reduce((a,r)=>a+(segR[r][m]||0),0)||undefined});
    const inv=aggMes(ads,a=>a.data,a=>a.valor);
    const ms=mesesAte(sel);
    corpo=`<div class="grid g3">${kpiCmp('Posts publicados',total,sel,NUM)}${kpiCmp('Reels',porF.Reels,sel,NUM)}${kpiCmp('Stories',porF.Stories,sel,NUM)}${kpiCmp('Curtidas nos posts do mês',curt,sel,NUM)}${kpiCmp('Seguidores (todas as redes)',seg,sel,NUM)}${kpiCmp('Investimento em mídia paga',inv,sel,R,true)}</div>
     ${blocoGrafico('g1','Posts por formato — 12 meses')}${blocoGrafico('g2','Seguidores por rede — crescimento')}${blocoGrafico('g3','Curtidas — 12 meses × mesmo mês do ano passado')}${blocoGrafico('g4','Investimento em mídia paga — 12 meses × mesmo mês do ano passado')}
     ${tabelaCmp('Posts por rede',redes.map(r=>[r,porR[r]]),sel,NUM)}${tabelaCmp('Curtidas por rede',redes.map(r=>[r,curtR[r]]),sel,NUM)}${tabelaCmp('Seguidores por rede',redes.map(r=>[r,segR[r]]),sel,NUM)}
     <p class="d" style="margin-top:8px">Mídia paga considera os lançamentos financeiros da categoria Anúncios. Seguidores e curtidas vêm das métricas coletadas todo dia; o histórico começa na data da primeira coleta.</p>`;
    pos=()=>{chart('g1',{type:'bar',data:{labels:ms.map(rotMes),datasets:Object.keys(porF).map((f,i)=>({label:f,data:ms.map(k=>porF[f][k]||0),backgroundColor:PAL[i],borderRadius:4}))},options:{plugins:{legend:{position:'bottom'}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:'#ffffff10'}}}}});
      chart('g2',{type:'line',data:{labels:ms.map(rotMes),datasets:redes.map((r,i)=>({label:r,data:ms.map(k=>segR[r][k]??null),borderColor:PAL[i%6],backgroundColor:PAL[i%6],tension:.3,spanGaps:true}))},options:{plugins:{legend:{position:'bottom'}},scales:{x:{grid:{display:false}},y:{grid:{color:'#ffffff10'}}}}});
      graficoSerie('g3',curt,sel,'Curtidas',NUM);graficoSerie('g4',inv,sel,'Investimento',R)};
  }
  v.innerHTML=`<div class="seg" style="margin-bottom:14px">${tabs.map(([k,l])=>`<button data-t="${k}" class="${S.cmpTab===k?'on':''}">${l}</button>`).join('')}</div>${corpo}`;
  v.querySelector('.seg').onclick=e=>{const b=e.target.closest('[data-t]');if(b){S.cmpTab=b.dataset.t;render()}};
  pos();
};
PAGES.comparativos.meta=['Comparativos','Mês atual × mês anterior × mesmo mês do ano passado, por setor'];
