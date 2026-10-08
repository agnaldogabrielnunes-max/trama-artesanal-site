// Feed Google Merchant / Shopping — https://tramaartesanal.com.br/.netlify/functions/feed-google
const S = require("../lib/seo.js");
const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
exports.handler = async () => {
  try {
    const lista = await S.carregarProdutos();
    const items = lista.map(p => {
      const mat = S.MATERIAL[p.categoria] ? ` em ${S.MATERIAL[p.categoria]}` : "";
      return `<item>
<g:id>${xml(p.codigo)}</g:id>
<g:title>${xml(`${p.nome}${mat} — ${p.tipo} para área externa`.slice(0, 150))}</g:title>
<g:description>${xml(S.descricao(p))}</g:description>
<g:link>${xml(`${S.SITE}/produto/${p.slug}`)}</g:link>
<g:image_link>${xml(p.fotos[0])}</g:image_link>${p.fotos.slice(1, 11).map(f => `<g:additional_image_link>${xml(f)}</g:additional_image_link>`).join("")}
<g:price>${p.menor.toFixed(2)} BRL</g:price>
<g:availability>in_stock</g:availability>
<g:condition>new</g:condition>
<g:brand>${xml(p.marca)}</g:brand>
<g:mpn>${xml(p.codigo)}</g:mpn>
<g:product_type>${xml(`Móveis para Área Externa > ${p.categoria} > ${p.tipo}`)}</g:product_type>
<g:google_product_category>Furniture</g:google_product_category>
<g:identifier_exists>false</g:identifier_exists>
</item>`; });
    return { statusCode: 200, headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>\n<title>Trama Artesanal — Móveis para Área Externa</title>\n<link>${S.SITE}</link>\n<description>Móveis para área externa em alumínio, corda náutica, fibra sintética e tela sling.</description>\n${items.join("\n")}\n</channel></rss>` };
  } catch (e) { return { statusCode: 500, body: "erro ao gerar feed" }; }
};
