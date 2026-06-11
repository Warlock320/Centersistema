import { XMLParser } from 'fast-xml-parser';

export interface NfeProduto {
  codigo: string;
  descricao: string;
  ean: string;           // código de barras (cEAN) — vazio se "SEM GTIN"
  ncm: string;
  cfop: string;
  unidade: string;       // uCom (ex.: CX12, UN)
  fatorSugerido: number; // desmembramento sugerido pela unidade (CX12 -> 12)
  quantidade: number;
  valorUnitario: number; // vUnCom (custo da unidade comercial, ex.: da caixa)
  valorTotal: number;
}

export interface NfeDuplicata { numero: string; vencimento: string; valor: number }

export interface NfeEmitente {
  nome: string;        // fantasia (ou razão social, se não houver fantasia)
  razaoSocial: string; // xNome
  cnpj: string;
  ie: string;
  endereco: string;    // logradouro, nº
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
}

export interface NfeData {
  chaveAcesso: string;
  numeroNota: number;
  emitenteNome: string;
  emitenteCnpj: string;
  emitente: NfeEmitente;
  valorTotal: number;
  dataEmissao: string;
  produtos: NfeProduto[];
  duplicatas: NfeDuplicata[];
}

function ean(v: unknown): string {
  const s = String(v || '').trim();
  return !s || s.toUpperCase().includes('SEM GTIN') ? '' : s;
}
function fatorDaUnidade(u: string): number {
  const m = String(u || '').match(/(\d{1,4})/);
  const n = m ? parseInt(m[1], 10) : 1;
  return n > 0 ? n : 1;
}

export function parseNfeXml(xmlContent: string): NfeData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    parseTagValue: true,
  });

  const parsed = parser.parse(xmlContent);
  const root = parsed.nfeProc || parsed.NFe || parsed;
  const nfe = root.NFe || root;
  const infNFe = nfe.infNFe;
  if (!infNFe) throw new Error('XML inválido: tag infNFe não encontrada');

  const ide = infNFe.ide;
  const emit = infNFe.emit;
  const total = infNFe.total?.ICMSTot;
  const chave = String(infNFe['@_Id'] || '').replace('NFe', '');

  const detRaw = infNFe.det;
  const detArray: unknown[] = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  const produtos: NfeProduto[] = detArray.map((det: unknown) => {
    const item = det as Record<string, unknown>;
    const prod = item.prod as Record<string, unknown>;
    const unidade = String(prod?.uCom || 'UN');
    return {
      codigo: String(prod?.cProd || ''),
      descricao: String(prod?.xProd || ''),
      ean: ean(prod?.cEAN) || ean(prod?.cEANTrib),
      ncm: String(prod?.NCM || ''),
      cfop: String(prod?.CFOP || ''),
      unidade,
      fatorSugerido: fatorDaUnidade(unidade),
      quantidade: Number(prod?.qCom || 0),
      valorUnitario: Number(prod?.vUnCom || 0),
      valorTotal: Number(prod?.vProd || 0),
    };
  });

  // Duplicatas (cobr/dup) → parcelas a pagar
  const dupRaw = infNFe.cobr?.dup;
  const dupArray: unknown[] = Array.isArray(dupRaw) ? dupRaw : dupRaw ? [dupRaw] : [];
  const duplicatas: NfeDuplicata[] = dupArray.map((d: unknown) => {
    const dup = d as Record<string, unknown>;
    return { numero: String(dup?.nDup || ''), vencimento: String(dup?.dVenc || ''), valor: Number(dup?.vDup || 0) };
  });

  const ender = (emit?.enderEmit || {}) as Record<string, unknown>;
  const razao = String(emit?.xNome || '');
  const logradouro = [ender.xLgr, ender.nro].filter(Boolean).join(', ');
  const emitente: NfeEmitente = {
    nome: String(emit?.xFant || razao),
    razaoSocial: razao,
    cnpj: String(emit?.CNPJ || ''),
    ie: String(emit?.IE || ''),
    endereco: logradouro,
    cidade: String(ender.xMun || ''),
    estado: String(ender.UF || ''),
    cep: String(ender.CEP || ''),
    telefone: String(ender.fone || ''),
  };

  return {
    chaveAcesso: chave,
    numeroNota: Number(ide?.nNF || 0),
    emitenteNome: razao,
    emitenteCnpj: String(emit?.CNPJ || ''),
    emitente,
    valorTotal: Number(total?.vNF || 0),
    dataEmissao: String(ide?.dhEmi || ide?.dEmi || ''),
    produtos,
    duplicatas,
  };
}
