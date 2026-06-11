import { XMLParser } from 'fast-xml-parser';

export interface NfeProduto {
  codigo: string;
  descricao: string;
  ean: string;           // código de barras (cEAN) — vazio se "SEM GTIN"
  ncm: string;
  cst: string;           // CST/CSOSN do ICMS
  cfop: string;
  unidade: string;       // uCom (ex.: CX12, UN)
  fatorSugerido: number; // desmembramento sugerido pela unidade (CX12 -> 12)
  quantidade: number;
  valorUnitario: number; // vUnCom (custo da unidade comercial, ex.: da caixa)
  valorTotal: number;
  // impostos (para o DANFE)
  baseIcms: number;
  valorIcms: number;
  valorIpi: number;
  aliqIcms: number;
  aliqIpi: number;
}

export interface NfeDuplicata { numero: string; vencimento: string; valor: number }

export interface NfeEmitente {
  nome: string;        // fantasia (ou razão social, se não houver fantasia)
  razaoSocial: string; // xNome
  cnpj: string;
  ie: string;
  endereco: string;    // logradouro, nº
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
}

export interface NfeDestinatario {
  nome: string;
  doc: string;
  ie: string;
  endereco: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
}

export interface NfeTotais {
  baseIcms: number; valorIcms: number;
  baseIcmsSt: number; valorIcmsSt: number;
  valorProdutos: number; valorFrete: number; valorSeguro: number;
  desconto: number; outrasDespesas: number; valorIpi: number;
  valorAproxTributos: number; valorTotal: number;
}

export interface NfeData {
  chaveAcesso: string;
  numeroNota: number;
  serie: number;
  naturezaOperacao: string;
  tipoNF: number;                 // 0 = entrada, 1 = saída
  protocolo: { numero: string; data: string };
  emitenteNome: string;
  emitenteCnpj: string;
  emitente: NfeEmitente;
  destinatario: NfeDestinatario;
  totais: NfeTotais;
  modalidadeFrete: string;        // modFrete (0..9)
  informacoesComplementares: string;
  valorTotal: number;             // = totais.valorTotal (compat)
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
const num = (v: unknown) => Number(v || 0);
const str = (v: unknown) => String(v ?? '');

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
  const dest = infNFe.dest;
  const total = infNFe.total?.ICMSTot;
  const chave = str(infNFe['@_Id']).replace('NFe', '');
  const infProt = (parsed.nfeProc?.protNFe || root.protNFe)?.infProt;

  const detRaw = infNFe.det;
  const detArray: unknown[] = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  const produtos: NfeProduto[] = detArray.map((det: unknown) => {
    const item = det as Record<string, unknown>;
    const prod = (item.prod || {}) as Record<string, unknown>;
    const imp = (item.imposto || {}) as Record<string, unknown>;
    const icmsWrap = (imp.ICMS || {}) as Record<string, unknown>;
    const icms = (Object.values(icmsWrap)[0] || {}) as Record<string, unknown>;
    const ipiTrib = ((imp.IPI as Record<string, unknown>)?.IPITrib || {}) as Record<string, unknown>;
    const unidade = str(prod.uCom || 'UN');
    return {
      codigo: str(prod.cProd),
      descricao: str(prod.xProd),
      ean: ean(prod.cEAN) || ean(prod.cEANTrib),
      ncm: str(prod.NCM),
      cst: str(icms.CST ?? icms.CSOSN ?? ''),
      cfop: str(prod.CFOP),
      unidade,
      fatorSugerido: fatorDaUnidade(unidade),
      quantidade: num(prod.qCom),
      valorUnitario: num(prod.vUnCom),
      valorTotal: num(prod.vProd),
      baseIcms: num(icms.vBC),
      valorIcms: num(icms.vICMS),
      valorIpi: num(ipiTrib.vIPI),
      aliqIcms: num(icms.pICMS),
      aliqIpi: num(ipiTrib.pIPI),
    };
  });

  const dupRaw = infNFe.cobr?.dup;
  const dupArray: unknown[] = Array.isArray(dupRaw) ? dupRaw : dupRaw ? [dupRaw] : [];
  const duplicatas: NfeDuplicata[] = dupArray.map((d: unknown) => {
    const dup = d as Record<string, unknown>;
    return { numero: str(dup.nDup), vencimento: str(dup.dVenc), valor: num(dup.vDup) };
  });

  const enderE = (emit?.enderEmit || {}) as Record<string, unknown>;
  const razao = str(emit?.xNome);
  const emitente: NfeEmitente = {
    nome: str(emit?.xFant || razao),
    razaoSocial: razao,
    cnpj: str(emit?.CNPJ),
    ie: str(emit?.IE),
    endereco: [enderE.xLgr, enderE.nro].filter(Boolean).join(', '),
    bairro: str(enderE.xBairro),
    cidade: str(enderE.xMun),
    estado: str(enderE.UF),
    cep: str(enderE.CEP),
    telefone: str(enderE.fone),
  };

  const enderD = (dest?.enderDest || {}) as Record<string, unknown>;
  const destinatario: NfeDestinatario = {
    nome: str(dest?.xNome),
    doc: str(dest?.CNPJ || dest?.CPF),
    ie: str(dest?.IE),
    endereco: [enderD.xLgr, enderD.nro].filter(Boolean).join(', '),
    bairro: str(enderD.xBairro),
    municipio: str(enderD.xMun),
    uf: str(enderD.UF),
    cep: str(enderD.CEP),
    telefone: str(enderD.fone),
  };

  const totais: NfeTotais = {
    baseIcms: num(total?.vBC), valorIcms: num(total?.vICMS),
    baseIcmsSt: num(total?.vBCST), valorIcmsSt: num(total?.vST),
    valorProdutos: num(total?.vProd), valorFrete: num(total?.vFrete),
    valorSeguro: num(total?.vSeg), desconto: num(total?.vDesc),
    outrasDespesas: num(total?.vOutro), valorIpi: num(total?.vIPI),
    valorAproxTributos: num(total?.vTotTrib), valorTotal: num(total?.vNF),
  };

  return {
    chaveAcesso: chave,
    numeroNota: num(ide?.nNF),
    serie: num(ide?.serie),
    naturezaOperacao: str(ide?.natOp),
    tipoNF: num(ide?.tpNF),
    protocolo: { numero: str(infProt?.nProt), data: str(infProt?.dhRecbto) },
    emitenteNome: razao,
    emitenteCnpj: str(emit?.CNPJ),
    emitente,
    destinatario,
    totais,
    modalidadeFrete: str(infNFe.transp?.modFrete),
    informacoesComplementares: str(infNFe.infAdic?.infCpl),
    valorTotal: totais.valorTotal,
    dataEmissao: str(ide?.dhEmi || ide?.dEmi),
    produtos,
    duplicatas,
  };
}
