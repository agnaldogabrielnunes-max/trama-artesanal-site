// Páginas de categoria — /categoria/<slug>
const S = require("../lib/seo.js");

exports.handler = async (event) => {
  try {
    const slug = (event.queryStringParameters || {}).slug || "";
    const c = S.CATEGORIAS.find(x => x.slug === slug);
    if (!c) return { statusCode: 302, headers: { Location: S.SITE } };
    const lista = S.filtrar(await S.carregarProdutos(), c);
    if (!lista.length) return { statusCode: 302, headers: { Location: S.SITE } };
    const url = `${S.SITE}/categoria/${c.slug}`;
    const menor = Math.min(...lista.map(p => p.menor));
    const title = `${c.h1} — a partir de ${S.fmt(menor)} | Trama Artesanal`;
    const desc = `${c.h1}: ${lista.length} modelos com 20% de desconto no Pix, 10x sem juros e garantia de 2 anos. Loja em Maringá-PR, entrega para todo o Brasil.`;
    const jsonld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: c.h1, url, description: desc,
        mainEntity: { "@type": "ItemList", itemListElement: lista.slice(0, 40).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${S.SITE}/produto/${p.slug}`, name: p.nome })) } },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: S.SITE + "/" },
        { "@type": "ListItem", position: 2, name: c.h1, item: url }] },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: S.FAQ_PADRAO.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ];
    const corpo = `<div class="bc"><a href="${S.SITE}/">Início</a> › ${S.esc(c.h1)}</div>
<h1>${S.esc(c.h1)}</h1><p class="intro">${S.esc(c.intro)}</p>
<p class="intro" style="margin-top:8px"><b>${lista.length} modelos</b> a partir de ${S.fmt(menor)} · 20% OFF no Pix · 10x sem juros.</p>
<div class="grid">${lista.slice(0, 120).map(S.cardProduto).join("")}</div>
<a class="btn site" href="${S.SITE}/">Ver catálogo completo</a><a class="btn zap" href="https://wa.me/${S.WHATSAPP}?text=${encodeURIComponent("Olá! Vi " + c.h1 + " no site e gostaria de ajuda.")}">Falar no WhatsApp</a>
<h2>Perguntas frequentes</h2>${S.FAQ_PADRAO.map(([a, b]) => `<details><summary>${S.esc(a)}</summary><p>${S.esc(b)}</p></details>`).join("")}
${S.linksCategorias(c.slug)}`;
    return { statusCode: 200, headers: S.HTML_HEADERS, body: S.pagina({ title, desc, canonical: url, og: lista[0].fotos[0], jsonld, corpo }) };
  } catch (e) {
    return { statusCode: 302, headers: { Location: S.SITE } };
  }
};
