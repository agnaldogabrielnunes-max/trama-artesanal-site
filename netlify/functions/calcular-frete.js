// build-version: 1782169595-
// netlify/functions/calcular-frete.js
//
// Endpoint público chamado pelo checkout para calcular o frete em tempo
// real, conforme o cliente digita o CEP. Não exige autenticação porque
// não envolve nenhum dado sensível nem ação de pagamento.

const { calcularFrete } = require('./frete.js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erro: 'Método não permitido.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'JSON inválido.' }) };
  }

  const { cep, valorCarrinho } = payload;

  if (!cep) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'CEP é obrigatório.' }) };
  }
  if (typeof valorCarrinho !== 'number' || valorCarrinho < 0) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'Valor do carrinho inválido.' }) };
  }

  const resultado = calcularFrete(cep, valorCarrinho);

  if (resultado.erro) {
    return { statusCode: 400, body: JSON.stringify({ erro: resultado.erro }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(resultado),
  };
};
