// build-version: 1782169595-
// netlify/functions/webhook-pagbank.js
//
// O PagBank chama esta URL automaticamente quando o status de um pedido
// muda (ex: pagamento aprovado, recusado, Pix pago).
//
// Por enquanto, esta function apenas registra a notificação nos logs do
// Netlify (Functions > webhook-pagbank > Logs). Numa fase futura, isso pode
// ser conectado a um banco de dados ou a um e-mail/WhatsApp automático de
// confirmação de pedido para o cliente e para você.

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

  // Estrutura típica de notificação do PagBank: contém id do pedido/cobrança
  // e o status atual. Registramos para conferência manual por enquanto.
  console.log('Webhook PagBank recebido:', JSON.stringify(notificacao, null, 2));

  // Responder 200 rapidamente é importante: o PagBank espera confirmação
  // de recebimento. Se não respondermos certo, eles tentam de novo.
  return {
    statusCode: 200,
    body: JSON.stringify({ recebido: true }),
  };
};
