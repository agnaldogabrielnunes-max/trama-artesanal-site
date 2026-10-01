// Página de produto — Trama Artesanal
// Cada produto do feed precisa de uma página própria; esta função gera ela na hora.
// URL: https://tramaartesanal.com.br/.netlify/functions/produto?id=<uuid>

const SB_URL = "https://qgunpfgdsqqgfkimvwhg.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndW5wZmdkc3FxZ2ZraW12d2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjQyMjIsImV4cCI6MjA5NzkwMDIyMn0.LUbnqiP1DPS1GEPrX5KYjHNYQeL_6V0bVgCzlEg49-Q";
const SITE = "https://tramaartesanal.com.br";
const WHATSAPP = "5544999104459"; // Letícia — vendas Trama Artesanal

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

exports.handler = async (event) => {
  try {
    const id = (event.queryStringParameters || {}).id || "";
    if (!/^[0-9a-f-]{36}$/.test(id)) return { statusCode: 302, headers: { Location: SITE } };

    const url = `${SB_URL}/rest/v1/produtos?select=id,codigo,tipo,categoria,nome_exibicao,produto_itens(nome,preco,medida,ordem),produto_fotos(url,ordem,is_principal)&id=eq.${id}&ativo=eq.true`;
    const resp = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    const rows = resp.ok ? await resp.json() : [];
    if (!rows.length) return { statusCode: 302, headers: { Location: SITE } };

    const p = rows[0];
    const fotos = (p.produto_fotos || []).sort((a, b) => (b.is_principal - a.is_principal) || (b.ordem - a.ordem));
    const itens = (p.produto_itens || []).filter(i => Number(i.preco) > 0).sort((a, b) => a.preco - b.preco);
    const titulo = p.nome_exibicao || `${p.tipo} em Alumínio e ${p.categoria}`;
    const menor = itens.length ? Number(itens[0].preco) : 0;
    const desc = `${p.tipo} artesanal em alumínio com pintura eletrostática e ${p.categoria}. Fabricação própria Trama Artesanal. Código ${p.codigo}.`;
    const zap = WHATSAPP
      ? `<a class="btn zap" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá! Tenho interesse no produto ${p.codigo} (${titulo}) que vi no site.`)}">Pedir orçamento no WhatsApp</a>`
      : "";

    const body = `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)} — ${esc(p.codigo)} | Trama Artesanal</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/.netlify/functions/produto?id=${p.id}">
<meta property="og:title" content="${esc(titulo)} | Trama Artesanal">
<meta property="og:description" content="${esc(desc)}">
${fotos[0] ? `<meta property="og:image" content="${esc(fotos[0].url)}">` : ""}
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "Product",
  name: titulo, sku: p.codigo, brand: { "@type": "Brand", name: "Trama Artesanal" },
  description: desc, image: fotos.map(f => f.url).slice(0, 10),
  offers: { "@type": "Offer", priceCurrency: "BRL", price: menor.toFixed(2),
    availability: "https://schema.org/InStock",
    url: `${SITE}/.netlify/functions/produto?id=${p.id}` }
})}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#F3F3EF;color:#1B211E;line-height:1.5}
.wrap{max-width:960px;margin:0 auto;padding:20px 16px 60px}
header a{color:#2E5C47;font-weight:700;text-decoration:none;font-size:20px}
header small{display:block;color:#68716C;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
h1{font-size:24px;margin:18px 0 4px}
.cod{color:#68716C;font-size:14px;margin-bottom:16px}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin:16px 0}
.gal img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:#fff}
.card{background:#fff;border:1px solid #E3E4DE;border-radius:12px;padding:20px;margin:16px 0}
.preco{font-size:26px;font-weight:700;color:#2E5C47}
.preco small{font-size:13px;color:#68716C;font-weight:400;display:block}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14.5px}
td{padding:9px 6px;border-bottom:1px solid #E3E4DE}
td:last-child{text-align:right;font-weight:600;white-space:nowrap}
.btn{display:inline-block;margin:14px 10px 0 0;padding:13px 22px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px}
.zap{background:#25D366;color:#fff}
.site{background:#2E5C47;color:#fff}
footer{margin-top:30px;color:#68716C;font-size:13px}
</style></head><body><div class="wrap">
<header><a href="${SITE}">Trama Artesanal</a><small>Móveis artesanais para área externa</small></header>
<h1>${esc(titulo)}</h1>
<div class="cod">Código ${esc(p.codigo)} · ${esc(p.categoria)}</div>
<div class="gal">${fotos.slice(0, 8).map(f => `<img src="${esc(f.url)}" alt="${esc(titulo)}" loading="lazy">`).join("")}</div>
<div class="card">
  <div class="preco">${menor ? "a partir de " + fmt(menor) : "Sob consulta"}<small>Fabricação própria · alumínio com pintura eletrostática</small></div>
  ${itens.length > 1 ? `<table>${itens.map(i => `<tr><td>${esc(i.nome || i.medida || "Opção")}${i.medida && i.nome ? " — " + esc(i.medida) : ""}</td><td>${fmt(i.preco)}</td></tr>`).join("")}</table>` : ""}
  ${zap}
  <a class="btn site" href="${SITE}">Ver catálogo completo e comprar</a>
</div>
<footer>Trama Artesanal — móveis em alumínio, corda náutica, fibra sintética e tela sling. Norte do Paraná.</footer>
</div></body></html>`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=1800" },
      body,
    };
  } catch (e) {
    return { statusCode: 302, headers: { Location: SITE } };
  }
};
