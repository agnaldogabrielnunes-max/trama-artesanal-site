import { createClient } from 'npm:@supabase/supabase-js@2';

// Robô de prospecção (agente Mercado): todo dia pega N buscas da fila, consulta a fonte de dados,
// grava leads novos com telefone/WhatsApp e registra a atividade. Quando a fila acaba, recicla.
// Fonte: Google Places quando a chave GOOGLE_PLACES_KEY existir; senão OpenStreetMap (grátis).
const KEY = 'larAg-7Hq2xP9mWc4Vt';
const PLACES_KEY = Deno.env.get('GOOGLE_PLACES_KEY');
const MIN_NOTA = 4.0;
const MIN_AVALIACOES = 5;
const UA = 'TramaArtesanal-Prospeccao/1.0 (+https://tramaartesanal.com.br)';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const dig = (s?: string) => (s || '').replace(/\D/g, '');
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

// Segmento da fila → etiquetas do OpenStreetMap.
const OSM_TAGS: Record<string, string[]> = {
  arquiteto: ['"office"="architect"'],
  paisagista: ['"craft"="gardener"', '"shop"="garden_centre"', '"office"="landscape_architect"'],
  construtora: ['"office"="construction_company"', '"craft"="builder"'],
  imobiliaria: ['"office"="estate_agent"'],
  condominio: ['"office"="property_management"'],
  hotel_pousada: ['"tourism"~"^(hotel|guest_house|hostel|motel|chalet)$"'],
  restaurante: ['"amenity"~"^(restaurant|cafe|bar)$"'],
  clinica: ['"amenity"~"^(clinic|dentist|doctors)$"', '"healthcare"~"^(clinic|dentist|physiotherapist)$"'],
  fazenda_haras: ['"leisure"="horse_riding"', '"place"="farm"', '"landuse"="farmyard"'],
};

type Lead = Record<string, unknown>;

async function buscarGoogle(f: any): Promise<{ encontrados: number; linhas: Lead[] }> {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber',
    },
    body: JSON.stringify({ textQuery: f.consulta, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20 }),
  });
  if (!r.ok) throw new Error(`Places ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const linhas = (j.places ?? [])
    .filter((p: any) => (p.rating ?? 0) >= MIN_NOTA && (p.userRatingCount ?? 0) >= MIN_AVALIACOES)
    .map((p: any) => ({
      nome: p.displayName?.text ?? 'sem nome', site: p.websiteUri ?? null,
      whatsapp: dig(p.internationalPhoneNumber || p.nationalPhoneNumber) || null,
      origem: `Google Places (${new Date().toISOString().slice(0, 10)})`, place_id: p.id,
      observacoes: `nota ${p.rating} (${p.userRatingCount} avaliações) · ${p.formattedAddress ?? ''}`,
    }));
  return { encontrados: j.places?.length ?? 0, linhas };
}

// Área da cidade pelo Nominatim (1 pedido por segundo, com identificação — regra de uso do OSM).
const areaCache = new Map<string, string>();
async function areaDaCidade(cidade: string, uf: string): Promise<string> {
  const chave = `${cidade}/${uf}`;
  if (areaCache.has(chave)) return areaCache.get(chave)!;
  await espera(1100);
  const q = encodeURIComponent(`${cidade}, ${uf}, Brasil`);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const [lugar] = await r.json();
  if (!lugar?.boundingbox) throw new Error(`cidade não encontrada no mapa: ${chave}`);
  const [s, n, w, e] = lugar.boundingbox;
  const bbox = `${s},${w},${n},${e}`;
  areaCache.set(chave, bbox);
  return bbox;
}

async function overpass(consulta: string): Promise<any[]> {
  let ultimoErro = '';
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(consulta) });
      if (r.ok) return (await r.json()).elements ?? [];
      ultimoErro = `Overpass ${r.status}`;
    } catch (e) { ultimoErro = String((e as Error).message); }
  }
  throw new Error(ultimoErro);
}

async function buscarOSM(f: any): Promise<{ encontrados: number; linhas: Lead[] }> {
  const tags = OSM_TAGS[f.segmento];
  if (!tags) throw new Error(`segmento sem mapeamento no OpenStreetMap: ${f.segmento}`);
  const bbox = await areaDaCidade(f.cidade, f.uf);
  const els = await overpass(`[out:json][timeout:40];(${tags.map(t => `nwr[${t}][name](${bbox});`).join('')});out tags 300;`);
  const linhas = els.map((el: any) => {
    const t = el.tags ?? {};
    const tel = t['contact:whatsapp'] || t['contact:mobile'] || t.mobile || t.phone || t['contact:phone'] || '';
    const site = t.website || t['contact:website'] || null;
    const insta = t['contact:instagram'] || null;
    const end = [t['addr:street'], t['addr:housenumber'], t['addr:suburb']].filter(Boolean).join(', ');
    return {
      nome: t.name, site, instagram: insta, email: t.email || t['contact:email'] || null,
      whatsapp: dig(String(tel).split(';')[0]) || null,
      origem: `OpenStreetMap (${new Date().toISOString().slice(0, 10)})`, place_id: `osm:${el.type}/${el.id}`,
      observacoes: [end, t.opening_hours ? `horário: ${t.opening_hours}` : ''].filter(Boolean).join(' · '),
    };
  // Sem nota de avaliação no OSM: só vale lead com algum jeito de contato.
  }).filter((l: Lead) => l.whatsapp || l.site || l.instagram || l.email);
  return { encontrados: els.length, linhas };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.searchParams.get('k') !== KEY) return J({ ok: false, erro: 'não autorizado' }, 401);
  const lote = Math.min(Number(url.searchParams.get('lote') ?? 8), 25);
  const fonte = PLACES_KEY ? 'google' : 'osm';

  const { data: ag } = await sb.from('agentes').select('id,empresa_id').eq('slug', 'mercado');
  const agPorEmpresa = new Map((ag ?? []).map((a: any) => [a.empresa_id, a.id]));
  const log = async (empresa_id: string, tipo: string, descricao: string, payload: unknown = {}) =>
    sb.from('agente_atividades').insert({ agente_id: agPorEmpresa.get(empresa_id) ?? null, empresa_id, tipo, descricao, payload });

  let { data: fila } = await sb.from('prospeccao_fila').select('*').eq('status', 'pendente').order('prioridade').order('criado_em').limit(lote);
  if (!fila?.length) {
    // fila acabou: recicla as concluídas há mais de 20 dias
    const corte = new Date(Date.now() - 20 * 864e5).toISOString();
    await sb.from('prospeccao_fila').update({ status: 'pendente' }).in('status', ['concluida', 'erro']).lt('ultima_execucao', corte);
    ({ data: fila } = await sb.from('prospeccao_fila').select('*').eq('status', 'pendente').order('prioridade').order('criado_em').limit(lote));
  }

  const resumo: Record<string, unknown>[] = [];
  const porEmpresa: Record<string, { novos: number; consultas: number }> = {};
  for (const f of fila ?? []) {
    await sb.from('prospeccao_fila').update({ status: 'em_andamento' }).eq('id', f.id);
    try {
      const { encontrados, linhas: base } = fonte === 'google' ? await buscarGoogle(f) : await buscarOSM(f);
      const linhas = base.map(l => ({
        ...l, empresa_id: f.empresa_id, segmento: f.segmento, cidade_uf: `${f.cidade}/${f.uf}`,
        proximo_passo: 'Tina: enviar saudação e apresentação do segmento', status: 'novo',
        proxima_acao_em: new Date().toISOString(),
      }));
      let novos = 0;
      if (linhas.length) {
        const { data: ins, error: e2 } = await sb.from('leads_b2b').upsert(linhas, { onConflict: 'empresa_id,place_id', ignoreDuplicates: true }).select('id');
        if (e2) throw new Error(e2.message);
        novos = ins?.length ?? 0;
      }
      await sb.from('prospeccao_fila').update({ status: 'concluida', ultima_execucao: new Date().toISOString(), leads_novos: novos }).eq('id', f.id);
      resumo.push({ consulta: f.consulta, encontrados, qualificados: linhas.length, novos });
      const pe = (porEmpresa[f.empresa_id] ??= { novos: 0, consultas: 0 }); pe.novos += novos; pe.consultas++;
    } catch (e) {
      await sb.from('prospeccao_fila').update({ status: 'erro', ultima_execucao: new Date().toISOString() }).eq('id', f.id);
      resumo.push({ consulta: f.consulta, erro: String((e as Error).message) });
      await log(f.empresa_id, 'erro', `Prospecção falhou em "${f.consulta}": ${(e as Error).message}`);
    }
  }
  const nomeFonte = fonte === 'google' ? 'Google Places' : 'OpenStreetMap';
  for (const [eid, v] of Object.entries(porEmpresa)) await log(eid, 'prospeccao', `Prospecção diária (${nomeFonte}): ${v.consultas} buscas, ${v.novos} novos leads com contato`, v);
  return J({ ok: true, fonte, processadas: resumo.length, resumo });
});
