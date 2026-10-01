// build-version: 1782169595-
// frete.js
// Calcula o frete com base no CEP do cliente e no valor total do carrinho.
// Regras (atualizadas pelo cliente em 02/07/2026):
//
//   PR                    -> grátis >= R$1.200
//   SC / RS / SP          -> grátis >= R$3.000
//   RJ / ES               -> grátis >= R$4.500
//   MT / MS / GO          -> grátis >= R$6.000
//   MG                    -> grátis >= R$5.000
//   Demais regiões        -> grátis >= R$7.000
//
// Prazo de entrega:
//   Sul e Sudeste (PR, SC, RS, SP, RJ, ES, MG)  -> 5 dias úteis
//   Norte e Nordeste                             -> 7 a 10 dias úteis
//   Demais (Centro-Oeste/DF)                     -> 7 dias úteis (padrão assumido,
//                                                    ajuste se o cliente definir outro prazo)
//
// Dentro de cada faixa, o frete é proporcional ao valor do carrinho:
// quanto mais próximo do limite de frete grátis, mais caro (até o máximo da faixa).
// Os valores de min/max de cada faixa foram estimados proporcionalmente ao novo
// limite de frete grátis (ajuste conforme necessário).

const FAIXAS = {
  GRUPO_PR: {
    ufs: ['PR'],
    min: 150,
    max: 500,
    gratisAcimaDe: 1200,
    prazoDias: '5 dias úteis',
  },
  GRUPO_SC_RS_SP: {
    ufs: ['SC', 'RS', 'SP'],
    min: 300,
    max: 900,
    gratisAcimaDe: 3000,
    prazoDias: '5 dias úteis',
  },
  GRUPO_RJ_ES: {
    ufs: ['RJ', 'ES'],
    min: 400,
    max: 1200,
    gratisAcimaDe: 4500,
    prazoDias: '5 dias úteis',
  },
  GRUPO_MG: {
    ufs: ['MG'],
    min: 450,
    max: 1400,
    gratisAcimaDe: 5000,
    prazoDias: '5 dias úteis',
  },
  GRUPO_MT_MS_GO: {
    ufs: ['MT', 'MS', 'GO'],
    min: 500,
    max: 1600,
    gratisAcimaDe: 6000,
    prazoDias: '7 dias úteis',
  },
  GRUPO_DEMAIS: {
    // fallback: Norte, Nordeste, DF e qualquer UF não listada acima
    ufs: null,
    min: 700,
    max: 2000,
    gratisAcimaDe: 7000,
    prazoDias: '7 a 10 dias úteis',
  },
};

const UFS_NORTE_NORDESTE = [
  'AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO', // Norte
  'AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE', // Nordeste
];

// Prazo de fabricação: todos os móveis são feitos sob encomenda.
// Esse prazo é somado ao prazo de entrega/transporte de cada região.
const PRAZO_FABRICACAO_DIAS = 30;

// Mapeamento de faixa de CEP -> UF (primeiros dígitos do CEP brasileiro)
// Referência: faixas oficiais de CEP por estado.
const CEP_PARA_UF = [
  { uf: 'SP', min: 1000000, max: 19999999 },
  { uf: 'RJ', min: 20000000, max: 28999999 },
  { uf: 'ES', min: 29000000, max: 29999999 },
  { uf: 'MG', min: 30000000, max: 39999999 },
  { uf: 'BA', min: 40000000, max: 48999999 },
  { uf: 'SE', min: 49000000, max: 49999999 },
  { uf: 'PE', min: 50000000, max: 56999999 },
  { uf: 'AL', min: 57000000, max: 57999999 },
  { uf: 'PB', min: 58000000, max: 58999999 },
  { uf: 'RN', min: 59000000, max: 59999999 },
  { uf: 'CE', min: 60000000, max: 63999999 },
  { uf: 'PI', min: 64000000, max: 64999999 },
  { uf: 'MA', min: 65000000, max: 65999999 },
  { uf: 'PA', min: 66000000, max: 68899999 },
  { uf: 'AP', min: 68900000, max: 68999999 },
  { uf: 'AM', min: 69000000, max: 69299999 },
  { uf: 'RR', min: 69300000, max: 69399999 },
  { uf: 'AM', min: 69400000, max: 69899999 },
  { uf: 'AC', min: 69900000, max: 69999999 },
  { uf: 'DF', min: 70000000, max: 72799999 },
  { uf: 'GO', min: 72800000, max: 76799999 },
  { uf: 'RO', min: 76800000, max: 76999999 },
  { uf: 'TO', min: 77000000, max: 77999999 },
  { uf: 'MT', min: 78000000, max: 78899999 },
  { uf: 'RO', min: 78900000, max: 78999999 },
  { uf: 'MS', min: 79000000, max: 79999999 },
  { uf: 'PR', min: 80000000, max: 87999999 },
  { uf: 'SC', min: 88000000, max: 89999999 },
  { uf: 'RS', min: 90000000, max: 99999999 },
];

function cepParaNumero(cep) {
  const limpo = String(cep).replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  return parseInt(limpo, 10);
}

function ufPorCep(cep) {
  const num = cepParaNumero(cep);
  if (num === null) return null;
  const faixa = CEP_PARA_UF.find(f => num >= f.min && num <= f.max);
  return faixa ? faixa.uf : null;
}

function faixaPorUf(uf) {
  const grupo = Object.values(FAIXAS).find(f => f.ufs && f.ufs.includes(uf));
  return grupo || FAIXAS.GRUPO_DEMAIS;
}

/**
 * Calcula o valor do frete em reais (não centavos).
 * @param {string} cep - CEP do destinatário (com ou sem máscara)
 * @param {number} valorCarrinho - valor total dos itens, em reais
 * @returns {{ uf: string|null, frete: number, gratis: boolean, faixa: object }}
 */
function calcularFrete(cep, valorCarrinho) {
  const uf = ufPorCep(cep);
  if (!uf) {
    return { uf: null, frete: null, gratis: false, erro: 'CEP inválido ou não reconhecido.' };
  }

  const faixa = faixaPorUf(uf);
  const prazoDias = UFS_NORTE_NORDESTE.includes(uf) ? FAIXAS.GRUPO_DEMAIS.prazoDias : faixa.prazoDias;

  if (valorCarrinho >= faixa.gratisAcimaDe) {
    return { uf, frete: 0, gratis: true, prazoDias, prazoFabricacaoDias: PRAZO_FABRICACAO_DIAS, faixa: { ...faixa, ufs: faixa.ufs } };
  }

  // Proporção do carrinho até o limite de frete grátis (0 a 1)
  const proporcao = Math.min(valorCarrinho / faixa.gratisAcimaDe, 1);
  const frete = faixa.min + proporcao * (faixa.max - faixa.min);

  return {
    uf,
    frete: Math.round(frete * 100) / 100,
    gratis: false,
    prazoDias,
    prazoFabricacaoDias: PRAZO_FABRICACAO_DIAS,
    faixa: { ...faixa, ufs: faixa.ufs },
  };
}

module.exports = { calcularFrete, ufPorCep, faixaPorUf };
