// Página de produto indexável — Trama Artesanal
// URL pública: /produto/<slug>  (redirect em netlify.toml). Compatível com ?id=<uuid> (redireciona 301).
const S = require("../lib/seo.js");

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    const lista = await S.carregarProdutos();
    let p;
    if (q.id) { p = lista.find(x => x.id === q.id); if (p) return { statusCode: 301, headers: { Location: `${S.SITE}/produto/${p.slug}` } }; }
    const m = String(event.path || '').match(/\/produto\/([^/?#]+)/);
    const slug = q.slug || (m && decodeURIComponent(m[1]));
    if (slug) p = lista.find(x => x.slug === slug);
    if (!p) return { statusCode: 302, headers: { Location: S.SITE } };

    const url = `${S.SITE}/produto/${p.slug}`;
    const desc = S.descricao(p);
    const mat = S.MATERIAL[p.categoria] ? ` em ${S.MATERIAL[p.categoria]}` : "";
    const title = `${p.nome}${mat} | ${p.tipo} para área externa — Trama Artesanal`;
    const relacionados = lista.filter(x => x.id !== p.id && x.tipo === p.tipo).slice(0, 4);
    const cat = S.CATEGORIAS.find(c => S.filtrar([p], c).length && !c.todos && c.tipos);
    const zap = `https://wa.me/${S.WHATSAPP}?text=${encodeURIComponent(`Olá! Tenho interesse no produto ${p.codigo} (${p.nome}) que vi no site.`)}`;
    const validade = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

    const jsonld = [{
      "@context": "https://schema.org", "@type": "Product", name: p.nome, sku: p.codigo, mpn: p.codigo,
      brand: { "@type": "Brand", name: p.marca }, category: `${p.tipo} > ${p.categoria}`, description: desc,
      image: p.fotos.slice(0, 10),
      offers: { "@type": "Offer", url, priceCurrency: "BRL", price: p.menor.toFixed(2), priceValidUntil: validade,
        availability: "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "Trama Artesanal" } },
    }, {
      "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: S.SITE + "/" },
        ...(cat ? [{ "@type": "ListItem", position: 2, name: cat.h1, item: `${S.SITE}/categoria/${cat.slug}` }] : []),
        { "@type": "ListItem", position: cat ? 3 : 2, name: p.nome, item: url }] }];

    const corpo = `<div class="bc"><a href="${S.SITE}/">Início</a>${cat ? ` › <a href="${S.SITE}/categoria/${cat.slug}">${S.esc(cat.h1)}</a>` : ""} › ${S.esc(p.nome)}</div>
<h1>${S.esc(p.nome)}${S.esc(mat)}</h1>
<p class="intro">${S.esc(p.tipo)} para área externa · ${S.esc(p.categoria)} · Código ${S.esc(p.codigo)}</p>
<div class="gal">${p.fotos.slice(0, 8).map((f, i) => `<img src="${S.esc(f)}" alt="${S.esc(p.nome)} — foto ${i + 1}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} width="600" height="450">`).join("")}</div>
<div class="box"><div class="preco">${p.itens.length > 1 ? "a partir de " : ""}${S.fmt(p.menor)}<small>ou ${S.fmt(p.menor * 0.8)} no Pix (20% OFF) · 10x sem juros no cartão</small></div>
${p.itens.length > 1 ? `<table>${p.itens.map(i => `<tr><td>${S.esc(i.nome || "Opção")}${i.medida ? " — " + S.esc(i.medida) : ""}</td><td>${S.fmt(i.preco)}</td></tr>`).join("")}</table>` : (p.itens[0].medida ? `<p style="margin-top:8px;color:#68716C">Medida: ${S.esc(p.itens[0].medida)}</p>` : "")}
<a class="btn zap" href="${zap}">Pedir orçamento no WhatsApp</a><a class="btn site" href="${S.SITE}/?busca=${encodeURIComponent(p.codigo)}">Comprar no site</a></div>
<h2>Sobre este produto</h2><p class="intro">${S.esc(desc)}</p>
<h2>Perguntas frequentes</h2>${S.FAQ_PADRAO.slice(0, 4).map(([a, b]) => `<details><summary>${S.esc(a)}</summary><p>${S.esc(b)}</p></details>`).join("")}
${relacionados.length ? `<h2>Você também pode gostar</h2><div class="grid">${relacionados.map(S.cardProduto).join("")}</div>` : ""}
${S.linksCategorias(cat && cat.slug)}`;

    return { statusCode: 200, headers: S.HTML_HEADERS, body: S.pagina({ title, desc, canonical: url, og: p.fotos[0], jsonld, corpo }) };
  } catch (e) {
    return { statusCode: 302, headers: { Location: S.SITE } };
  }
};
