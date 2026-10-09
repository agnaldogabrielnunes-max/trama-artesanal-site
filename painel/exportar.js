/* LAR · exportar qualquer tela do painel: Excel, PDF ou impressão (lê as tabelas visíveis) */
(function(){
  const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'];
  const loaded={};
  const load=u=>loaded[u]||(loaded[u]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=()=>no(new Error('Não foi possível carregar '+u));document.head.appendChild(s)}));
  const txt=el=>{const i=el.querySelector('input:not([type=checkbox]),select');if(i&&!el.textContent.trim().replace(/\s+/g,'')){return i.tagName==='SELECT'?(i.options[i.selectedIndex]?.text||''):i.value}
    const c=el.querySelector('input[type=checkbox]');if(c&&!el.textContent.trim())return c.checked?'sim':'';return el.innerText.replace(/\s+/g,' ').trim()};
  function coletar(){
    const out=[];
    document.querySelectorAll('#view table').forEach((t,n)=>{
      const heads=[...t.querySelectorAll('thead th')].map(h=>h.innerText.trim());
      const linhas=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(txt));
      if(!linhas.length)return;
      const card=t.closest('.card');const h=card?.querySelector('h3,h4');
      out.push({titulo:(h?.innerText||'').replace(/\s+/g,' ').trim()||('Tabela '+(n+1)),heads:heads.length?heads:linhas[0].map((_,i)=>'Col '+(i+1)),linhas});
    });
    return out;
  }
  const meta=()=>{const emp=S.emps.find(e=>e.id==S.emp)?.nome||'Todas as empresas';const t=document.getElementById('ttl').textContent;return {titulo:t,empresa:emp,quando:new Date().toLocaleString('pt-BR')}};
  const slug=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w]+/g,'-').toLowerCase();
  const num=s=>{const m=String(s).trim().match(/^-?R\$\s*([\d.]+,\d{2})$/);if(!m)return s;const v=Number(m[1].replace(/\./g,'').replace(',','.'));return String(s).trim().startsWith('-')?-v:v};
  async function excel(){
    const T=coletar();if(!T.length)return alert('Não há tabelas nesta tela para exportar.');
    await load(LIBS[0]);const m=meta();const wb=XLSX.utils.book_new();
    const usados=new Set();
    T.forEach((t,i)=>{const aoa=[[m.titulo+' — '+m.empresa],['Gerado em '+m.quando],[],t.heads,...t.linhas.map(r=>r.map(num))];
      const ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=t.heads.map((h,c)=>({wch:Math.min(48,Math.max(10,h.length+2,...t.linhas.map(r=>String(r[c]??'').length+2)))}));
      let nome=t.titulo.replace(/[\\\/?*\[\]:]/g,' ').slice(0,28)||('Tabela '+(i+1));while(usados.has(nome))nome=nome.slice(0,25)+' '+(i+1);usados.add(nome);
      XLSX.utils.book_append_sheet(wb,ws,nome)});
    XLSX.writeFile(wb,`${slug(m.titulo)}-${slug(m.empresa)}-${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  async function pdf(){
    const T=coletar();if(!T.length)return alert('Não há tabelas nesta tela para exportar.');
    await load(LIBS[1]);await load(LIBS[2]);const m=meta();
    const doc=new window.jspdf.jsPDF({orientation:T.some(t=>t.heads.length>5)?'landscape':'portrait',unit:'pt',format:'a4'});
    let y=40;doc.setFontSize(15);doc.setTextColor(11,37,53);doc.text(m.titulo,40,y);doc.setFontSize(9);doc.setTextColor(90);doc.text(`${m.empresa} · gerado em ${m.quando} · LAR Estratégia Digital`,40,y+14);y+=30;
    T.forEach(t=>{doc.setFontSize(11);doc.setTextColor(11,37,53);if(y>doc.internal.pageSize.getHeight()-80){doc.addPage();y=40}doc.text(t.titulo,40,y);
      doc.autoTable({startY:y+6,head:[t.heads],body:t.linhas,styles:{fontSize:8,cellPadding:3},headStyles:{fillColor:[31,122,140]},margin:{left:40,right:40}});y=doc.lastAutoTable.finalY+22});
    const n=doc.internal.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(120);doc.text(`Página ${i} de ${n}`,doc.internal.pageSize.getWidth()-90,doc.internal.pageSize.getHeight()-20)}
    doc.save(`${slug(m.titulo)}-${slug(m.empresa)}-${new Date().toISOString().slice(0,10)}.pdf`);
  }
  function imprimir(){
    const T=coletar();if(!T.length)return alert('Não há tabelas nesta tela para imprimir.');const m=meta();
    const e=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const w=window.open('','_blank');if(!w)return alert('Libere pop-ups para imprimir.');
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${e(m.titulo)}</title><style>body{font:12px Arial,sans-serif;color:#111;margin:24px}h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px}p{color:#555;margin:2px 0 12px}table{border-collapse:collapse;width:100%}th{background:#1F7A8C;color:#fff;text-align:left}th,td{border:1px solid #ccc;padding:4px 6px;font-size:11px}tr:nth-child(even) td{background:#f5f8fa}@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style>
    <h1>${e(m.titulo)}</h1><p>${e(m.empresa)} · gerado em ${e(m.quando)} · LAR Estratégia Digital</p>${T.map(t=>`<h2>${e(t.titulo)}</h2><table><thead><tr>${t.heads.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${t.linhas.map(r=>`<tr>${r.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}`);
    w.document.close();w.focus();setTimeout(()=>w.print(),400);
  }
  const wrap=async f=>{try{await f()}catch(e){alert('Erro ao exportar: '+e.message)}};
  const _render=render;
  render=async function(){
    await _render();
    const tools=document.getElementById('tools');if(!tools||tools.querySelector('.exp'))return;
    const d=document.createElement('span');d.className='exp';d.style.cssText='display:inline-flex;gap:6px;margin-left:10px;vertical-align:middle';
    d.innerHTML='<button class="btn ghost sm" data-x="xlsx">Excel</button><button class="btn ghost sm" data-x="pdf">PDF</button><button class="btn ghost sm" data-x="print">Imprimir</button>';
    d.onclick=e=>{const b=e.target.closest('[data-x]');if(!b)return;wrap(b.dataset.x==='xlsx'?excel:b.dataset.x==='pdf'?pdf:imprimir)};
    tools.appendChild(d);
  };
})();
