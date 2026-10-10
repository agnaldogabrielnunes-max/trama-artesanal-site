// Sitemap dinâmico — https://tramaartesanal.com.br/sitemap.xml
const S = require("../lib/seo.js");
const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
exports.handler = async () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = [`<url><loc>${S.SITE}/</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`];
  urls.push(`<url><loc>${S.SITE}/blog/</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  for (const b of ["como-cuidar-de-moveis-de-area-externa-limpeza-manutencao-sol-chuva","tendencias-decoracao-varanda-area-externa-2026","prepare-sua-casa-para-festas-de-fim-de-ano-natal-reveillon","como-escolher-moveis-area-externa-marcas-confiaveis-evitar-golpes","como-funciona-compra-de-moveis-sob-encomenda-prazo-garantia-entrega"]) urls.push(`<url><loc>${S.SITE}/blog/${b}</loc><lastmod>${hoje}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
  try {
    const lista = await S.carregarProdutos();
    for (const c of S.CATEGORIAS) if (S.filtrar(lista, c).length)
      urls.push(`<url><loc>${S.SITE}/categoria/${c.slug}</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    for (const p of lista)
      urls.push(`<url><loc>${S.SITE}/produto/${p.slug}</loc><lastmod>${hoje}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority>${p.fotos.slice(0, 5).map(f => `<image:image><image:loc>${x(f)}</image:loc><image:title>${x(p.nome)}</image:title></image:image>`).join("")}</url>`);
  } catch (e) { /* devolve ao menos a home */ }
  return { statusCode: 200, headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>` };
};
