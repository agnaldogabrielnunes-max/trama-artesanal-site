// Feed Google Shopping — Trama Artesanal
// Gera XML (RSS 2.0 + namespace g:) direto do Supabase.
// URL final: https://tramaartesanal.com.br/.netlify/functions/feed-google

const SB_URL = "https://qgunpfgdsqqgfkimvwhg.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndW5wZmdkc3FxZ2ZraW12d2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjQyMjIsImV4cCI6MjA5NzkwMDIyMn0.LUbnqiP1DPS1GEPrX5KYjHNYQeL_6V0bVgCzlEg49-Q";
const SITE = "https://tramaartesanal.com.br";

const xml = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

exports.handler = async () => {
  try {
    const url = `${SB_URL}/rest/v1/produtos?select=id,codigo,tipo,categoria,nome_exibicao,produto_itens(preco,medida),produto_fotos(url,ordem,is_principal)&ativo=eq.true`;
    const resp = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (!resp.ok) throw new Error(`Supabase ${resp.status}`);
    const produtos = await resp.json();

    const items = [];
    for (const p of produtos) {
      const precos = (p.produto_itens || []).map(i => Number(i.preco)).filter(v => v > 0);
      const fotos = (p.produto_fotos || []).sort((a, b) =>
        (b.is_principal - a.is_principal) || (b.ordem - a.ordem));
      if (!precos.length || !fotos.length) continue; // sem preço ou sem foto: fora do feed

      const preco = Math.min(...precos).toFixed(2);
      const titulo = p.nome_exibicao
        ? `${p.nome_exibicao} — ${p.codigo}`
        : `${p.tipo} em Alumínio e ${p.categoria} — ${p.codigo}`;
      const desc = `${p.tipo} artesanal em alumínio com pintura eletrostática e ${p.categoria}, ` +
        `fabricação própria Trama Artesanal (Norte do Paraná). Móvel para área externa: varanda, ` +
        `piscina, jardim e área gourmet. Diversas medidas disponíveis. Código ${p.codigo}.`;
      const link = `${SITE}/.netlify/functions/produto?id=${p.id}`;
      const extras = fotos.slice(1, 11)
        .map(f => `<g:additional_image_link>${xml(f.url)}</g:additional_image_link>`).join("");

      items.push(`<item>
<g:id>${xml(p.codigo)}</g:id>
<g:title>${xml(titulo)}</g:title>
<g:description>${xml(desc)}</g:description>
<g:link>${xml(link)}</g:link>
<g:image_link>${xml(fotos[0].url)}</g:image_link>${extras}
<g:price>${preco} BRL</g:price>
<g:availability>in_stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Trama Artesanal</g:brand>
<g:product_type>${xml(`Móveis para Área Externa > ${p.categoria} > ${p.tipo}`)}</g:product_type>
<g:identifier_exists>false</g:identifier_exists>
</item>`);
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Trama Artesanal — Móveis para Área Externa</title>
<link>${SITE}</link>
<description>Móveis artesanais em alumínio, corda náutica, fibra sintética e tela sling. Fabricação própria.</description>
${items.join("\n")}
</channel>
</rss>`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=3600",
      },
      body,
    };
  } catch (e) {
    return { statusCode: 500, body: "Erro ao gerar feed: " + e.message };
  }
};
