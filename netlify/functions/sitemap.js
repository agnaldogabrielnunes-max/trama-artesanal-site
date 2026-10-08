// Sitemap dinâmico — Trama Artesanal
// URL pública: https://www.tramaartesanal.com.br/sitemap.xml (redirect em netlify.toml)
const SB_URL = "https://qgunpfgdsqqgfkimvwhg.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndW5wZmdkc3FxZ2ZraW12d2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjQyMjIsImV4cCI6MjA5NzkwMDIyMn0.LUbnqiP1DPS1GEPrX5KYjHNYQeL_6V0bVgCzlEg49-Q";
const SITE = "https://www.tramaartesanal.com.br";

exports.handler = async () => {
  const hoje = new Date().toISOString().slice(0, 10);
  let urls = [`<url><loc>${SITE}/</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/produtos?select=id&ativo=eq.true`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (r.ok) {
      const rows = await r.json();
      for (const p of rows) {
        urls.push(`<url><loc>${SITE}/.netlify/functions/produto?id=${p.id}</loc><lastmod>${hoje}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
      }
    }
  } catch (e) { /* devolve ao menos a home */ }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`,
  };
};
