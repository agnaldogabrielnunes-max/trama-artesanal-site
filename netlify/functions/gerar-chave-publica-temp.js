// Função TEMPORÁRIA — usada uma única vez para gerar a chave pública do PagBank (sandbox).
// Depois de usar, este arquivo deve ser removido do projeto.

exports.handler = async function () {
  const token = process.env.PAGBANK_TOKEN;
  const ambiente = process.env.PAGBANK_AMBIENTE || 'sandbox';
  const baseUrl = ambiente === 'producao'
    ? 'https://api.pagseguro.com'
    : 'https://sandbox.api.pagseguro.com';

  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'PAGBANK_TOKEN não configurado.' }),
    };
  }

  try {
    const resp = await fetch(`${baseUrl}/public-keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'card' }),
    });

    const data = await resp.json();

    return {
      statusCode: resp.ok ? 200 : resp.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ambiente, baseUrl, resultado: data }, null, 2),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'Falha de conexão com o PagBank', detalhes: String(e) }),
    };
  }
};
