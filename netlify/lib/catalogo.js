// netlify/lib/catalogo.js
//
// Recalcula no servidor o preço de cada item do carrinho, a partir do
// catálogo do banco (a mesma fonte que o site usa para mostrar os preços).
// Assim ninguém consegue pagar menos alterando o preço no navegador.
//
// O id do item no carrinho é "CODIGO::indice" ou "CODIGO::indice#opcao",
// onde indice é a posição do item no produto (ordenado por "ordem") e
// opcao é a posição em produto_itens.opcoes (ex.: corda náutica / fibra).

const SUPABASE_URL = 'https://qgunpfgdsqqgfkimvwhg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zf7UMVosztpLCHpAYRvoHA_WX9_X0wy';

const DESCONTO_ATACADO = 0.20;

function lerId(id) {
  const m = /^(.+?)::(\d+)(?:#(\d+))?$/.exec(String(id || ''));
  if (!m) return null;
  return { codigo: m[1], indice: Number(m[2]), opcao: m[3] === undefined ? null : Number(m[3]) };
}

// Lojista com CNPJ cadastrado tem 20% de desconto. Só vale com login válido.
async function ehClienteAtacado(token) {
  if (!token) return false;
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const respUser = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!respUser.ok) return false;
  const user = await respUser.json();
  if (!user || !user.id) return false;
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/clientes_atacado?id=eq.${encodeURIComponent(user.id)}&select=id`, { headers });
  if (!resp.ok) return false;
  const linhas = await resp.json();
  return Array.isArray(linhas) && linhas.length > 0;
}

// Devolve { itens: [{ id, nome, quantidade, precoUnitario }], atacado } com os
// preços do banco, ou { erro } se algum item não existir / não estiver à venda.
async function precificarCarrinho(itensCarrinho, atacadoToken) {
  const lidos = itensCarrinho.map(item => ({ item, ref: lerId(item.id) }));
  if (lidos.some(x => !x.ref)) {
    return { erro: 'Seu carrinho tem um item antigo. Atualize a página, monte o carrinho de novo e tente outra vez.' };
  }
  for (const { item } of lidos) {
    const q = Number(item.quantidade);
    if (!Number.isInteger(q) || q < 1 || q > 50) return { erro: 'Quantidade inválida no carrinho.' };
  }

  const codigos = [...new Set(lidos.map(x => x.ref.codigo))];
  const filtro = codigos.map(c => `"${c.replace(/"/g, '')}"`).join(',');
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/produtos?select=codigo,produto_itens(nome,preco,ordem,opcoes)&ativo=eq.true&codigo=in.(${encodeURIComponent(filtro)})`,
    { headers: { apikey: SUPABASE_KEY } }
  );
  if (!resp.ok) throw new Error(`catálogo indisponível (${resp.status})`);
  const produtos = {};
  (await resp.json()).forEach(p => {
    produtos[p.codigo] = (p.produto_itens || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  });

  const atacado = await ehClienteAtacado(atacadoToken);
  const fator = atacado ? 1 - DESCONTO_ATACADO : 1;

  const itens = [];
  for (const { item, ref } of lidos) {
    const linha = (produtos[ref.codigo] || [])[ref.indice];
    const op = linha && ref.opcao !== null ? (Array.isArray(linha.opcoes) ? linha.opcoes[ref.opcao] : null) : null;
    if (!linha || (ref.opcao !== null && !op)) {
      return { erro: `O item "${item.nome}" não está mais disponível. Atualize a página e confira o carrinho.` };
    }
    const base = op ? Number(op.p) : Number(linha.preco);
    if (!(base > 0)) return { erro: `O item "${item.nome}" está sem preço. Fale com a gente no WhatsApp.` };
    itens.push({
      id: item.id,
      nome: `${linha.nome}${op ? ` (${op.l})` : ''} — ${ref.codigo}`,
      quantidade: Number(item.quantidade),
      precoUnitario: Math.round(base * fator * 100) / 100,
    });
  }
  return { itens, atacado };
}

module.exports = { precificarCarrinho };
