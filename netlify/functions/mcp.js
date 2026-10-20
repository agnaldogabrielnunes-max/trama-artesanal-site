// netlify/functions/mcp.js
//
// Endereço do conector MCP da Trama para o claude.ai:
//   https://tramaartesanal.com.br/mcp/<CHAVE>
//
// Repassa as chamadas para o servidor MCP no Supabase (trama-mcp). Existe
// porque o claude.ai, ao receber 401 ou ao consultar /.well-known no domínio
// do Supabase, tenta um login OAuth que o servidor não tem e o conector fica
// "não conectado" (e some das tarefas agendadas). Aqui a chave vai no caminho
// e o domínio do site responde 404 nos /.well-known, então ele conecta sem login.

const DESTINO = 'https://qgunpfgdsqqgfkimvwhg.supabase.co/functions/v1/trama-mcp';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const chave = event.path.split('/').filter(Boolean).pop() || '';
  const corpo = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;

  const resp = await fetch(`${DESTINO}?k=${encodeURIComponent(chave)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: corpo,
  });
  // Chave errada vira 403: um 401 faria o claude.ai tentar login OAuth.
  const status = resp.status === 401 ? 403 : resp.status;
  return {
    statusCode: status,
    headers: { 'Content-Type': resp.headers.get('content-type') || 'application/json', ...CORS },
    body: await resp.text(),
  };
};
