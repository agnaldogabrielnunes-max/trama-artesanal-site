// netlify/lib/erp.js
//
// Liga o checkout do site ao ERP (Supabase). As duas funções do banco
// (site_registrar_pedido e site_atualizar_pagamento) só aceitam chamadas
// com o segredo SITE_PEDIDOS_SEGREDO, configurado nas variáveis de
// ambiente do Netlify — ele nunca vai para o navegador.

const SUPABASE_URL = 'https://qgunpfgdsqqgfkimvwhg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zf7UMVosztpLCHpAYRvoHA_WX9_X0wy';

async function rpc(funcao, args) {
  const segredo = process.env.SITE_PEDIDOS_SEGREDO;
  if (!segredo) throw new Error('SITE_PEDIDOS_SEGREDO não configurado no Netlify.');
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcao}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ p_segredo: segredo, ...args }),
  });
  const texto = await resp.text();
  if (!resp.ok) throw new Error(`${funcao} falhou (${resp.status}): ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

// Grava o pedido como "pendente" logo depois do PagBank aceitar a cobrança.
function registrarPedido(dados) {
  return rpc('site_registrar_pedido', { p: dados });
}

// Atualiza o status pelo que o PagBank informou. Ao virar "pago", o banco
// cria o pedido no painel (Vendas / Fluxo) e a entrada no financeiro.
function atualizarPagamento(referenceId, statusPagbank) {
  return rpc('site_atualizar_pagamento', { p_referencia: referenceId, p_pagbank_status: statusPagbank });
}

module.exports = { registrarPedido, atualizarPagamento };
