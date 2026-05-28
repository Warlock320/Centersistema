import { XMLParser } from 'fast-xml-parser';

export interface NfeProduto {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface NfeData {
  chaveAcesso: string;
  numeroNota: number;
  emitenteNome: string;
  emitenteCnpj: string;
  valorTotal: number;
  dataEmissao: string;
  produtos: NfeProduto[];
}

export function parseNfeXml(xmlContent: string): NfeData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    parseTagValue: true,
  });

  const parsed = parser.parse(xmlContent);

  // Navega até a raiz nfeProc ou nfe
  const root = parsed.nfeProc || parsed.NFe || parsed;
  const nfe = root.NFe || root;
  const infNFe = nfe.infNFe;

  if (!infNFe) throw new Error('XML inválido: tag infNFe não encontrada');

  const ide = infNFe.ide;
  const emit = infNFe.emit;
  const total = infNFe.total?.ICMSTot;
  const chave = infNFe['@_Id']?.replace('NFe', '') || '';

  // Garante que det seja sempre um array
  const detRaw = infNFe.det;
  const detArray: unknown[] = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  const produtos: NfeProduto[] = detArray.map((det: unknown) => {
    const item = det as Record<string, unknown>;
    const prod = item.prod as Record<string, unknown>;
    return {
      codigo: String(prod?.cProd || prod?.cEANTrib || ''),
      descricao: String(prod?.xProd || ''),
      ncm: String(prod?.NCM || ''),
      cfop: String(prod?.CFOP || ''),
      quantidade: Number(prod?.qCom || 0),
      valorUnitario: Number(prod?.vUnCom || 0),
      valorTotal: Number(prod?.vProd || 0),
    };
  });

  return {
    chaveAcesso: chave,
    numeroNota: Number(ide?.nNF || 0),
    emitenteNome: String(emit?.xNome || ''),
    emitenteCnpj: String(emit?.CNPJ || ''),
    valorTotal: Number(total?.vNF || 0),
    dataEmissao: String(ide?.dhEmi || ide?.dEmi || ''),
    produtos,
  };
}
