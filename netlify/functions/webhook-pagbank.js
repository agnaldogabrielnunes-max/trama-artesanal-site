// netlify/functions/webhook-pagbank.js
//
// O PagBank chama esta URL automaticamente quando o status de um pedido
// muda (ex: pagamento aprovado, recusado, Pix pago).
//
// Não confiamos no corpo da notificação: pegamos só o id do pedido e
// consultamos o status verdadeiro na API do PagBank (com o nosso token).
// Depois atualizamos o ERP — quando o pedido fica pago, ele aparece no
// painel (Vendas / Fluxo do pedido) e entra no Financeiro.

const { atualizarPagamento } = require('../lib/erp.js');

const PAGBANK_SANDBOX = 'https://sandbox.api.pagseguro.com';
const PAGBANK_PRODUCAO = 'https://api.pagseguro.com';

function baseUrl() {
  return process.env.PAGBANK_AMBIENTE === 'producao' ? PAGBANK_PRODUCAO : PAGBANK_SANDBOX;
}

// Resume o pedido do PagBank em um status só: PAID, DECLINED, CANCELED ou o que vier.
function statusDoPedido(pedido) {
  const cobrancas = Array.isArray(pedido.charges) ? pedido.charges : [];
  const st = cobrancas.map(c => String(c.status || '').toUpperCase());
  if (st.includes('PAID')) return 'PAID';
  if (st.length && st.every(s => s === 'DECLINED')) return 'DECLINED';
  if (st.length && st.every(s => s === 'CANCELED')) return 'CANCELED';
  return st[0] || 'WAITING';
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método não permitido.' };
  }

  let notificacao;
  try {
    notificacao = JSON.parse(event.body);
  } catch (e) {
    console.error('Webhook PagBank: corpo inválido', event.body);
    return { statusCode: 400, body: 'JSON inválido.' };
  }

  const pedidoId = notificacao && notificacao.id;
  if (!pedidoId || !/^ORDE_/.test(pedidoId)) {
    console.log('Webhook PagBank ignorado (sem id de pedido):', JSON.stringify(notificacao));
    return { statusCode: 200, body: JSON.stringify({ recebido: true, ignorado: true }) };
  }

  try {
    const resp = await fetch(`${baseUrl()}/orders/${encodeURIComponent(pedidoId)}`, {
      headers: { Authorization: `Bearer ${process.env.PAGBANK_TOKEN}` },
    });
    const pedido = await resp.json();
    if (!resp.ok) throw new Error(`consulta ao PagBank falhou (${resp.status}): ${JSON.stringify(pedido)}`);

    const status = statusDoPedido(pedido);
    const resultado = await atualizarPagamento(pedido.reference_id, status);
    console.log(`Webhook PagBank: ${pedido.reference_id} ${status} -> ERP: ${resultado}`);

    return { statusCode: 200, body: JSON.stringify({ recebido: true, status: resultado }) };
  } catch (erro) {
    // Respondendo erro, o PagBank tenta de novo mais tarde.
    console.error('Webhook PagBank: falha ao atualizar o ERP', pedidoId, erro.message);
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao processar notificação.' }) };
  }
};
