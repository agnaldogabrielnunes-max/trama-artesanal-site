// Biblioteca SEO compartilhada — Trama Artesanal
// Fonte única de: produtos publicáveis, slugs, títulos, descrições e páginas de categoria.
const SB_URL = "https://qgunpfgdsqqgfkimvwhg.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndW5wZmdkc3FxZ2ZraW12d2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjQyMjIsImV4cCI6MjA5NzkwMDIyMn0.LUbnqiP1DPS1GEPrX5KYjHNYQeL_6V0bVgCzlEg49-Q";
const SITE = "https://www.tramaartesanal.com.br";
const WHATSAPP = "5544999104459";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const MATERIAL = { "Corda Náutica": "corda náutica", "Alumínio": "alumínio", "Fibra Sintética": "fibra sintética", "Tela Sling": "tela sling", "Madeira": "madeira" };
const EXCLUIR_TIPOS = new Set(["Saarinen"]);
const EXCLUIR_CATEGORIAS = new Set(["Office"]);

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) throw new Error("Supabase " + r.status);
  return r.json();
}

// O banco agrupa linhas inteiras (ex.: "Poltrona Atlântica") sob tipo "Sofá": deduz o tipo real pelo nome.
function tipoReal(nome, tipo) {
  const n = String(nome || "");
  if (/^Poltrona/i.test(n)) return "Poltrona";
  if (/^Chaise/i.test(n)) return "Chaise";
  if (/^(Puff|Banco\b)/i.test(n)) return "Puff/Banco";
  if (/^(Sofá|Módulo|Cantoneira)/i.test(n)) return "Sofá";
  if (/^Espregui/i.test(n)) return "Espreguiçadeira";
  if (/^Banqueta/i.test(n)) return "Banqueta/Bistrô";
  if (/^Cadeira/i.test(n)) return "Cadeira";
  if (/^Mesa de (centro|canto|apoio)|^Mesa lateral/i.test(n)) return "Mesa de Centro/Lateral";
  if (/^(Mesa|Jogo)/i.test(n) && !/^Jogo de Sofá/i.test(n)) return tipo === "Mesa de Centro/Lateral" ? tipo : "Mesa";
  return tipo;
}
let cache = { t: 0, lista: null };
async function carregarProdutos() {
  if (cache.lista && Date.now() - cache.t < 10 * 60 * 1000) return cache.lista;
  const out = [];
  for (let off = 0; off < 3000; off += 1000) {
    const rows = await sb(`produtos?select=id,codigo,tipo,categoria,nome_exibicao,ordem,fornecedor:fornecedores(nome),produto_itens(nome,preco,medida,ordem),produto_fotos(url,ordem,is_principal)&ativo=eq.true&order=ordem,codigo&limit=1000&offset=${off}`);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  const lista = [];
  const usados = new Set();
  for (const p of out) {
    if (EXCLUIR_TIPOS.has(p.tipo) || EXCLUIR_CATEGORIAS.has(p.categoria)) continue;
    if (/teste/i.test(p.nome_exibicao || "")) continue;
    const itens = (p.produto_itens || []).filter(i => Number(i.preco) > 0).sort((a, b) => a.preco - b.preco);
    const fotos = (p.produto_fotos || []).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99)).map(f => f.url);
    if (!itens.length || !fotos.length) continue;
    const tipo = tipoReal(p.nome_exibicao, p.tipo);
    const nome = p.nome_exibicao || `${tipo}${MATERIAL[p.categoria] ? " em " + MATERIAL[p.categoria] : " " + p.categoria} ${p.codigo.replace(/^\D+[:_]?/, "")}`;
    let slug = `${slugify(nome)}-${slugify(p.codigo)}`;
    if (usados.has(slug)) slug += "-" + p.id.slice(0, 4);
    usados.add(slug);
    lista.push({
      id: p.id, codigo: p.codigo, tipo, categoria: p.categoria, nome, slug,
      marca: p.fornecedor?.nome && p.fornecedor.nome !== "Importados Trama" ? p.fornecedor.nome : "Trama Artesanal",
      proprio: !p.fornecedor,
      itens, fotos, menor: Number(itens[0].preco),
    });
  }
  cache = { t: Date.now(), lista };
  return lista;
}

function descricao(p) {
  const mat = MATERIAL[p.categoria] ? ` em ${MATERIAL[p.categoria]}` : "";
  const art = /^(Sofá|Chaise|Mesa|Banqueta)/.test(p.tipo) ? "" : "";
  const fab = p.proprio ? "Fabricação própria Trama Artesanal" : `Marca ${p.marca}, revenda oficial Trama Artesanal`;
  return `${p.nome}${mat}: ${p.tipo.toLowerCase()} para área externa, varanda, piscina e área gourmet. ${fab}. ` +
    `A partir de ${fmt(p.menor)} — 20% de desconto no Pix, 10x sem juros no cartão e garantia de 2 anos. Entrega para todo o Brasil, loja em Maringá-PR.${art}`;
}

// ---------- Páginas de categoria (palavras-chave que o cliente pesquisa) ----------
const CATEGORIAS = [
  { slug: "sofas-para-area-externa", h1: "Sofás para área externa", tipos: ["Sofá"],
    intro: "Sofás e módulos para varanda, área gourmet e beira de piscina, em corda náutica, fibra sintética e alumínio com pintura eletrostática. Estrutura resistente a sol e chuva e almofadas com tecido para uso externo." },
  { slug: "poltronas-para-area-externa", h1: "Poltronas para área externa", tipos: ["Poltrona"],
    intro: "Poltronas confortáveis para varanda, jardim e sala externa. Trançadas em corda náutica ou fibra sintética, com estrutura em alumínio que não enferruja." },
  { slug: "cadeiras-para-area-externa", h1: "Cadeiras para área externa", tipos: ["Cadeira"], excluirCategorias: ["Office", "Cadeiras Design"],
    intro: "Cadeiras para mesa de jantar externa, varanda e área gourmet. Corda náutica, tela sling e alumínio: leves, duráveis e prontas para o tempo." },
  { slug: "mesas-para-area-externa", h1: "Mesas para área externa", tipos: ["Mesa", "Mesa de Centro/Lateral"], excluirCategorias: ["Mesas Ajustáveis", "Mesas de Centro em Mármore (Natural)", "Mesas"],
    intro: "Mesas de jantar, centro e laterais para área externa. Tampos em madeira, alumínio, vidro e pedra sinterizada, com bases em alumínio resistentes ao tempo." },
  { slug: "chaises-e-espreguicadeiras", h1: "Chaises e espreguiçadeiras para piscina", tipos: ["Chaise", "Espreguiçadeira"],
    intro: "Espreguiçadeiras e chaises para a beira da piscina, deck e jardim. Estruturas em alumínio com tela sling, corda náutica ou fibra sintética, secagem rápida e fácil limpeza." },
  { slug: "banquetas-e-bistros", h1: "Banquetas e mesas bistrô", tipos: ["Banqueta/Bistrô", "Banqueta"],
    intro: "Banquetas e mesas bistrô para bancada gourmet, churrasqueira e balcão. Alturas de assento de 60 a 75 cm, em alumínio, corda náutica e fibra sintética." },
  { slug: "balancos-e-redes", h1: "Balanços e redes para varanda", tipos: ["Balanço", "Rede"],
    intro: "Balanços de varanda e redes de jardim para relaxar ao ar livre. Estrutura reforçada e acabamento pensado para sol, chuva e maresia." },
  { slug: "puffs-e-bancos", h1: "Puffs e bancos para área externa", tipos: ["Puff/Banco", "Puff"],
    intro: "Puffs e bancos para apoiar os pés, compor ambientes ou ter assento extra. Em corda náutica, fibra sintética e tecidos para uso externo." },
  { slug: "ombrelones-e-acessorios", h1: "Ombrelones e acessórios para área externa", tipos: ["Ombrelone", "Acessório", "Almofada", "Tapete", "Lareira", "Tacho", "Apoio"],
    intro: "Ombrelones, almofadas, tapetes, capas e acessórios para completar a sua área externa com proteção e conforto." },
  { slug: "moveis-corda-nautica", h1: "Móveis em corda náutica", categorias: ["Corda Náutica"],
    intro: "Corda náutica é o trançado que não desbota nem apodrece: resiste a sol, chuva e cloro. Sofás, poltronas, mesas e chaises com estrutura em alumínio, direto de quem entende de área externa." },
  { slug: "moveis-de-aluminio-para-area-externa", h1: "Móveis de alumínio para área externa", categorias: ["Alumínio"],
    intro: "Móveis de alumínio com pintura eletrostática: não enferrujam, são leves e duram anos a céu aberto. Ideais para piscina, varanda e áreas litorâneas." },
  { slug: "moveis-fibra-sintetica", h1: "Móveis em fibra sintética", categorias: ["Fibra Sintética"],
    intro: "Fibra sintética tecida à mão sobre estrutura de alumínio, o clássico dos móveis de varanda. Resistente a raios UV, fácil de limpar e com visual sofisticado." },
  { slug: "moveis-tela-sling", h1: "Móveis em tela sling", categorias: ["Tela Sling"],
    intro: "Tela sling seca rápido, é fresca no calor e não retém água. Perfeita para espreguiçadeiras, cadeiras e banquetas de piscina." },
  { slug: "moveis-area-externa-maringa", h1: "Móveis para área externa em Maringá", todos: true,
    intro: "A Trama Artesanal é uma loja de móveis para área externa em Maringá, Paraná, com entrega para todo o Brasil. Atendemos consumidor final, arquitetos, hotéis, pousadas, construtoras e incorporadoras, com condições especiais para CNPJ." },
];

function filtrar(lista, c) {
  return lista.filter(p => {
    if (c.todos) return true;
    if (c.tipos && !c.tipos.includes(p.tipo)) return false;
    if (c.categorias && !c.categorias.includes(p.categoria)) return false;
    if (c.excluirCategorias && c.excluirCategorias.includes(p.categoria)) return false;
    return true;
  });
}

const FAQ_PADRAO = [
  ["Qual o desconto no Pix?", "Pagando no Pix você tem 20% de desconto. No cartão parcelamos em até 10x sem juros."],
  ["Os móveis podem ficar ao sol e na chuva?", "Sim. Trabalhamos com alumínio de pintura eletrostática, corda náutica, fibra sintética e tela sling, materiais próprios para área externa. Recomendamos capa de proteção para vida útil ainda maior."],
  ["Vocês entregam em todo o Brasil?", "Sim. Enviamos para todo o Brasil e calculamos o frete direto no site. Há frete grátis em condições especiais de região e valor. A loja fica em Maringá, Paraná."],
  ["Qual a garantia?", "Garantia de 2 anos contra defeitos de fabricação."],
  ["Vendem para hotéis, pousadas e construtoras?", "Sim. Temos condições especiais para CNPJ, projetos e arquitetos. Fale com a gente pelo WhatsApp."],
];

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;background:#F3F3EF;color:#1B211E;line-height:1.55}
.wrap{max-width:1100px;margin:0 auto;padding:20px 16px 60px}header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-bottom:12px;border-bottom:1px solid #E3E4DE}
header a.logo{color:#2E5C47;font-weight:700;text-decoration:none;font-size:20px}nav a{color:#2E5C47;text-decoration:none;font-size:14px;margin-left:14px}
.bc{font-size:13px;color:#68716C;margin:14px 0}.bc a{color:#68716C}h1{font-size:28px;margin:8px 0 10px;line-height:1.2}h2{font-size:20px;margin:30px 0 10px}
.intro{max-width:760px;color:#3a423e}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;margin-top:20px}
.card{background:#fff;border:1px solid #E3E4DE;border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;display:block}.card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#eee;display:block}
.card div{padding:12px}.card b{display:block;font-size:15px}.card small{color:#68716C}.card .p{margin-top:6px;font-weight:700;color:#2E5C47}.card .p span{display:block;font-weight:400;font-size:12px;color:#68716C}
.btn{display:inline-block;margin:14px 10px 0 0;padding:13px 22px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px}.zap{background:#25D366;color:#fff}.site{background:#2E5C47;color:#fff}
.box{background:#fff;border:1px solid #E3E4DE;border-radius:12px;padding:20px;margin:16px 0}.preco{font-size:28px;font-weight:700;color:#2E5C47}.preco small{font-size:13px;color:#68716C;font-weight:400;display:block}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin:16px 0}.gal img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:#fff}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14.5px}td{padding:9px 6px;border-bottom:1px solid #E3E4DE}td:last-child{text-align:right;font-weight:600;white-space:nowrap}
details{background:#fff;border:1px solid #E3E4DE;border-radius:10px;padding:12px 16px;margin:8px 0}summary{cursor:pointer;font-weight:600}
.links a{display:inline-block;margin:4px 8px 4px 0;padding:6px 12px;background:#fff;border:1px solid #E3E4DE;border-radius:20px;color:#2E5C47;text-decoration:none;font-size:14px}
footer{margin-top:40px;color:#68716C;font-size:13px}`;

function cabecalho() {
  return `<header><a class="logo" href="${SITE}/">Trama Artesanal</a><nav><a href="${SITE}/categoria/sofas-para-area-externa">Sofás</a><a href="${SITE}/categoria/poltronas-para-area-externa">Poltronas</a><a href="${SITE}/categoria/mesas-para-area-externa">Mesas</a><a href="${SITE}/categoria/chaises-e-espreguicadeiras">Piscina</a><a href="${SITE}/">Catálogo completo</a></nav></header>`;
}
function linksCategorias(atual) {
  return `<h2>Veja também</h2><div class="links">${CATEGORIAS.filter(c => c.slug !== atual).map(c => `<a href="${SITE}/categoria/${c.slug}">${esc(c.h1)}</a>`).join("")}</div>`;
}
function cardProduto(p) {
  return `<a class="card" href="${SITE}/produto/${p.slug}"><img src="${esc(p.fotos[0])}" alt="${esc(p.nome)} — ${esc(p.tipo)} para área externa" loading="lazy" width="400" height="300"><div><b>${esc(p.nome)}</b><small>${esc(p.categoria)}</small><div class="p">a partir de ${fmt(p.menor)}<span>${fmt(p.menor * 0.8)} no Pix</span></div></div></a>`;
}
function pagina({ title, desc, canonical, og, jsonld, corpo }) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canonical}">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="Trama Artesanal"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canonical}">${og ? `<meta property="og:image" content="${esc(og)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(og)}">` : ""}
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
<style>${CSS}</style></head><body><div class="wrap">${cabecalho()}${corpo}<footer>Trama Artesanal — móveis para área externa. Loja em Maringá-PR, entrega para todo o Brasil. Desenvolvido por LAR Marketing Digital.</footer></div></body></html>`;
}
const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=1800" };

module.exports = { SITE, WHATSAPP, esc, fmt, slugify, MATERIAL, carregarProdutos, descricao, CATEGORIAS, filtrar, FAQ_PADRAO, linksCategorias, cardProduto, pagina, HTML_HEADERS };
