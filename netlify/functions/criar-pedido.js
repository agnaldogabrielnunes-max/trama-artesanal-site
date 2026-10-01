// build-version: 1782169595-
// netlify/functions/criar-pedido.js
//
// Recebe o carrinho + dados do cliente do front-end, calcula o frete,
// e cria um pedido na API do PagBank (sandbox por padrão).
//
// IMPORTANTE — Segurança:
// O token do PagBank NUNCA fica neste arquivo. Ele vem de uma variável
// de ambiente configurada no painel do Netlify (Site settings > Environment
// variables), chamada PAGBANK_TOKEN. Assim, a chave nunca aparece no
// código-fonte nem no navegador do cliente.
//
// Ambiente: controlado pela variável PAGBANK_AMBIENTE ("sandbox" ou "producao").
// Por padrão usamos sandbox até a homologação ser concluída.

const { calcularFrete } = require('./frete.js');

const PAGBANK_SANDBOX_URL = 'https://sandbox.api.pagseguro.com/orders';
const PAGBANK_PRODUCAO_URL = 'https://api.pagseguro.com/orders';

function getPagbankUrl() {
  const ambiente = process.env.PAGBANK_AMBIENTE || 'sandbox';
  return ambiente === 'producao' ? PAGBANK_PRODUCAO_URL : PAGBANK_SANDBOX_URL;
}

function validarCpf(cpf) {
  const limpo = String(cpf || '').replace(/\D/g, '');
  return limpo.length === 11;
}

function centavos(valorReais) {
  return Math.round(valorReais * 100);
}

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

  const {
    cliente,      // { nome, email, cpf, telefone }
    endereco,     // { cep, rua, numero, complemento, bairro, cidade, uf }
    itens,        // [{ nome, quantidade, precoUnitario }]
    metodoPagamento, // "PIX" ou "CARTAO"
    parcelas,     // número de parcelas (1 a 10), só para cartão
    cartao,       // { encrypted } - token do cartão criptografado pelo SDK do PagBank no navegador
  } = payload;

  // --- Validações básicas ---
  if (!cliente || !cliente.nome || !cliente.email || !cliente.cpf) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'Dados do cliente incompletos (nome, email e CPF são obrigatórios).' }) };
  }
  if (!validarCpf(cliente.cpf)) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'CPF inválido.' }) };
  }
  if (!endereco || !endereco.cep) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'Endereço de entrega com CEP é obrigatório.' }) };
  }
  const telefoneDigitos = cliente.telefone ? String(cliente.telefone).replace(/\D/g, '') : '';
  if (!telefoneDigitos || telefoneDigitos.length < 10 || telefoneDigitos.length > 11) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).' }) };
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'Carrinho vazio.' }) };
  }
  if (!['PIX', 'CARTAO'].includes(metodoPagamento)) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'Método de pagamento inválido.' }) };
  }
  if (metodoPagamento === 'CARTAO' && (!parcelas || parcelas < 1 || parcelas > 10)) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'Número de parcelas inválido (1 a 10).' }) };
  }
  if (metodoPagamento === 'CARTAO' && (!cartao || !cartao.encrypted)) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'Dados do cartão não foram recebidos corretamente.' }) };
  }

  // --- Cálculo do valor total dos itens ---
  const valorItens = itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);

  // --- Cálculo do frete ---
  const resultadoFrete = calcularFrete(endereco.cep, valorItens);
  if (resultadoFrete.erro) {
    return { statusCode: 400, body: JSON.stringify({ erro: resultadoFrete.erro }) };
  }

  const subtotalComFrete = valorItens + resultadoFrete.frete;

  // --- Desconto de 20% para pagamento à vista (Pix ou cartão em 1x) ---
  // Esta decisão é sempre tomada aqui no backend, nunca confiando em um
  // valor "já com desconto" vindo do navegador — assim ninguém consegue
  // manipular o desconto alterando o código no cliente.
  const DESCONTO_AVISTA = 0.20;
  const temDesconto = metodoPagamento === 'PIX' || (metodoPagamento === 'CARTAO' && parcelas === 1);
  const valorDesconto = temDesconto ? subtotalComFrete * DESCONTO_AVISTA : 0;
  const valorTotal = subtotalComFrete - valorDesconto;

  const referenceId = `TRAMA-${Date.now()}`;

  // Fator de desconto aplicado a cada item e ao frete, para que a soma dos
  // itens enviados ao PagBank sempre seja igual ao valor cobrado.
  const fatorDesconto = temDesconto ? 1 - DESCONTO_AVISTA : 1;

  // --- Monta o corpo da requisição para a API de Pedidos do PagBank ---
  const corpoPedido = {
    reference_id: referenceId,
    customer: {
      name: cliente.nome,
      email: cliente.email,
      tax_id: String(cliente.cpf).replace(/\D/g, ''),
      phones: telefoneDigitos
        ? [
            {
              country: '55',
              area: telefoneDigitos.slice(0, 2),
              number: telefoneDigitos.slice(2),
              type: 'MOBILE',
            },
          ]
        : [],
    },
    items: itens.map((item, idx) => ({
      reference_id: `item-${idx}`,
      name: temDesconto ? `${item.nome} (20% desc. à vista)` : item.nome,
      quantity: item.quantidade,
      unit_amount: centavos(item.precoUnitario * fatorDesconto),
    })),
    shipping: {
      address: {
        street: endereco.rua || '',
        number: endereco.numero || 'S/N',
        complement: endereco.complemento || 'S/N',
        locality: endereco.bairro || '',
        city: endereco.cidade || '',
        region_code: resultadoFrete.uf,
        country: 'BRA',
        postal_code: String(endereco.cep).replace(/\D/g, ''),
      },
    },
    notification_urls: [process.env.URL ? `${process.env.URL}/.netlify/functions/webhook-pagbank` : ''],
  };

  // --- Monta a cobrança conforme o método de pagamento ---
  if (metodoPagamento === 'PIX') {
    corpoPedido.qr_codes = [
      {
        amount: { value: centavos(valorTotal) },
      },
    ];
  } else {
    corpoPedido.charges = [
      {
        reference_id: `charge-${referenceId}`,
        description: 'Compra Trama Artesanal',
        amount: { value: centavos(valorTotal), currency: 'BRL' },
        payment_method: {
          type: 'CREDIT_CARD',
          installments: parcelas,
          capture: true,
          card: {
            encrypted: cartao.encrypted,
            security_code: cartao.cvv,
            store: false,
            holder: {
              name: (cartao.nomeTitular || cliente.nome).trim(),
              tax_id: String(cliente.cpf).replace(/\D/g, ''),
            },
          },
        },
      },
    ];
  }

  const token = process.env.PAGBANK_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'Configuração ausente: PAGBANK_TOKEN não foi definido nas variáveis de ambiente do Netlify.' }),
    };
  }

  try {
    const resposta = await fetch(getPagbankUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpoPedido),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      return {
        statusCode: resposta.status,
        body: JSON.stringify({ erro: 'PagBank rejeitou o pedido.', detalhes: dados }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        sucesso: true,
        pedidoId: dados.id,
        referenceId,
        frete: resultadoFrete.frete,
        descontoAplicado: temDesconto,
        valorDesconto,
        valorTotal,
        pagbank: dados,
      }),
    };
  } catch (erro) {
    return {
      statusCode: 502,
      body: JSON.stringify({ erro: 'Falha ao comunicar com o PagBank.', detalhes: erro.message }),
    };
  }
};
