import { XMLBuilder } from 'fast-xml-parser';
import { getCodigoUF } from './constants';
import type { Empresa, Cliente, PedidoItem } from '@/types/database.types';

export interface NfeBuildInput {
  empresa: Empresa;
  cliente: Cliente;
  itens: (PedidoItem & {
    ncm: string;
    cfop: string;
    origem: number;
    csosn?: string;
    cst_icms?: string;
    aliquota_icms: number;
    cst_pis: string;
    cst_cofins: string;
    aliquota_pis: number;
    aliquota_cofins: number;
    cest?: string;
    codigo_produto?: string;
  })[];
  numero: number;
  serie: number;
  ambiente: number; // 1=produção, 2=homologação
  naturezaOperacao?: string;
}

export interface NfeBuildResult {
  xml: string;
  chaveAcesso: string;
  infNFeId: string;
}

function pad(n: number | string, len: number): string {
  return String(n).padStart(len, '0');
}

function digits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

function dec(v: number, casas: number): string {
  return v.toFixed(casas);
}

function gerarCodigoNumerico(): string {
  return pad(Math.floor(Math.random() * 99999999), 8);
}

function calcularDigitoVerificador(chave43: string): string {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  const chars = chave43.split('').reverse();
  for (let i = 0; i < chars.length; i++) {
    soma += parseInt(chars[i]) * pesos[i % pesos.length];
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return String(dv);
}

export function gerarChaveAcesso(
  cUF: string, aamm: string, cnpj: string,
  mod: string, serie: number, nNF: number,
  tpEmis: number, cNF: string
): string {
  const chave43 =
    pad(cUF, 2) + aamm +
    pad(digits(cnpj), 14) +
    pad(mod, 2) + pad(serie, 3) + pad(nNF, 9) +
    pad(tpEmis, 1) + pad(cNF, 8);
  return chave43 + calcularDigitoVerificador(chave43);
}

export function buildNfeXml(input: NfeBuildInput): NfeBuildResult {
  const { empresa, cliente, itens, numero, serie, ambiente } = input;
  const natOp = input.naturezaOperacao || 'VENDA DE MERCADORIA';

  const agora = new Date();
  const dhEmi = agora.toISOString().replace(/\.\d{3}Z$/, '-03:00');
  const aamm = pad(agora.getFullYear() % 100, 2) + pad(agora.getMonth() + 1, 2);

  const cUF = empresa.codigo_uf || getCodigoUF(empresa.estado || 'SP');
  const cnpj14 = pad(digits(empresa.cnpj), 14);
  const cNF = gerarCodigoNumerico();
  const chaveAcesso = gerarChaveAcesso(cUF, aamm, cnpj14, '55', serie, numero, 1, cNF);
  const infNFeId = `NFe${chaveAcesso}`;

  const isSimples = (empresa.regime_tributario || 1) <= 2;
  const destUF = cliente.estado || empresa.estado || 'SP';
  const operacaoInterestadual = destUF !== empresa.estado;

  // Calcula totais dos produtos
  let vProd = 0, vBC = 0, vICMS = 0, vPIS = 0, vCOFINS = 0;

  const detArray = itens.map((item, idx) => {
    const vUnCom = Number(item.preco_unitario);
    const qCom = Number(item.quantidade);
    const vProdItem = parseFloat((vUnCom * qCom).toFixed(2));
    vProd += vProdItem;

    const cfop = operacaoInterestadual
      ? String(Number(item.cfop || '5102') + 1000)
      : (item.cfop || '5102');

    // ICMS
    let icmsTag: Record<string, unknown>;
    if (isSimples) {
      const csosn = item.csosn || '102';
      icmsTag = {
        [`ICMSSN${csosn === '500' ? '500' : '102'}`]: {
          orig: item.origem || 0,
          ...(csosn === '500'
            ? { CSOSN: '500', vBCSTRet: '0.00', vICMSSTRet: '0.00', vICMSSubstituto: '0.00' }
            : { CSOSN: csosn }
          ),
        },
      };
    } else {
      const cst = item.cst_icms || '00';
      const aliq = item.aliquota_icms || 0;
      const baseItem = vProdItem;
      const icmsItem = parseFloat((baseItem * aliq / 100).toFixed(2));
      if (cst === '00' || cst === '20') {
        vBC += baseItem;
        vICMS += icmsItem;
      }
      icmsTag = {
        [`ICMS${cst}`]: {
          orig: item.origem || 0,
          CST: cst,
          modBC: 3,
          vBC: dec(cst === '00' || cst === '20' ? baseItem : 0, 2),
          pICMS: dec(aliq, 4),
          vICMS: dec(cst === '00' || cst === '20' ? icmsItem : 0, 2),
        },
      };
    }

    // PIS
    const pisCst = item.cst_pis || '99';
    const pisVal = parseFloat((vProdItem * (item.aliquota_pis || 0) / 100).toFixed(2));
    vPIS += pisVal;
    const pisTag = ['01', '02'].includes(pisCst) ? {
      PISAliq: { CST: pisCst, vBC: dec(vProdItem, 2), pPIS: dec(item.aliquota_pis || 0, 4), vPIS: dec(pisVal, 2) },
    } : {
      PISOutr: { CST: pisCst, vBC: '0.00', pPIS: '0.00', vPIS: '0.00' },
    };

    // COFINS
    const cofinsCst = item.cst_cofins || '99';
    const cofinsVal = parseFloat((vProdItem * (item.aliquota_cofins || 0) / 100).toFixed(2));
    vCOFINS += cofinsVal;
    const cofinsTag = ['01', '02'].includes(cofinsCst) ? {
      COFINSAliq: { CST: cofinsCst, vBC: dec(vProdItem, 2), pCOFINS: dec(item.aliquota_cofins || 0, 4), vCOFINS: dec(cofinsVal, 2) },
    } : {
      COFINSOutr: { CST: cofinsCst, vBC: '0.00', pCOFINS: '0.00', vCOFINS: '0.00' },
    };

    return {
      '@_nItem': idx + 1,
      prod: {
        cProd: item.codigo_produto || pad(idx + 1, 4),
        cEAN: 'SEM GTIN',
        xProd: ambiente === 2 ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : item.descricao,
        NCM: (item.ncm || '00000000').replace(/\D/g, ''),
        ...(item.cest ? { CEST: item.cest.replace(/\D/g, '') } : {}),
        CFOP: cfop,
        uCom: 'UN',
        qCom: dec(qCom, 4),
        vUnCom: dec(vUnCom, 10),
        vProd: dec(vProdItem, 2),
        cEANTrib: 'SEM GTIN',
        uTrib: 'UN',
        qTrib: dec(qCom, 4),
        vUnTrib: dec(vUnCom, 10),
        indTot: 1,
      },
      imposto: {
        ICMS: icmsTag,
        PIS: pisTag,
        COFINS: cofinsTag,
      },
    };
  });

  const vNF = parseFloat(vProd.toFixed(2));

  // Destinatário
  const docDest = digits(cliente.cpf_cnpj);
  const destTag: Record<string, unknown> = {};
  if (docDest.length === 14) {
    destTag.CNPJ = docDest;
  } else if (docDest.length === 11) {
    destTag.CPF = docDest;
  }

  const indIEDest = cliente.indicador_ie ?? (docDest.length === 14 ? 1 : 9);
  destTag.xNome = ambiente === 2 ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : cliente.nome;
  destTag.enderDest = {
    xLgr: cliente.endereco || 'NAO INFORMADO',
    nro: cliente.numero || 'S/N',
    ...(cliente.complemento ? { xCpl: cliente.complemento } : {}),
    xBairro: cliente.bairro || 'NAO INFORMADO',
    cMun: cliente.codigo_municipio || empresa.codigo_municipio || '0000000',
    xMun: cliente.cidade || 'NAO INFORMADO',
    UF: destUF,
    CEP: pad(digits(cliente.cep), 8) || '00000000',
    cPais: '1058',
    xPais: 'BRASIL',
    ...(cliente.telefone ? { fone: digits(cliente.telefone) } : {}),
  };
  destTag.indIEDest = indIEDest;
  if (indIEDest === 1 && cliente.inscricao_estadual) {
    destTag.IE = digits(cliente.inscricao_estadual);
  }

  const nfeObj = {
    NFe: {
      '@_xmlns': 'http://www.portalfiscal.inf.br/nfe',
      infNFe: {
        '@_versao': '4.00',
        '@_Id': infNFeId,
        ide: {
          cUF: cUF,
          cNF: cNF,
          natOp: natOp,
          mod: 55,
          serie: serie,
          nNF: numero,
          dhEmi: dhEmi,
          dhSaiEnt: dhEmi,
          tpNF: 1,
          idDest: operacaoInterestadual ? 2 : 1,
          cMunFG: empresa.codigo_municipio || '0000000',
          tpImp: 1,
          tpEmis: 1,
          cDV: chaveAcesso.slice(-1),
          tpAmb: ambiente,
          finNFe: 1,
          indFinal: indIEDest === 9 ? 1 : 0,
          indPres: 1,
          indIntermed: 0,
          procEmi: 0,
          verProc: 'GestaoERP 1.0',
        },
        emit: {
          CNPJ: cnpj14,
          xNome: empresa.razao_social,
          ...(empresa.nome !== empresa.razao_social ? { xFant: empresa.nome } : {}),
          enderEmit: {
            xLgr: empresa.endereco || 'NAO INFORMADO',
            nro: empresa.numero || 'S/N',
            ...(empresa.complemento ? { xCpl: empresa.complemento } : {}),
            xBairro: empresa.bairro || 'NAO INFORMADO',
            cMun: empresa.codigo_municipio || '0000000',
            xMun: empresa.cidade || 'NAO INFORMADO',
            UF: empresa.estado || 'SP',
            CEP: pad(digits(empresa.cep), 8),
            cPais: '1058',
            xPais: 'BRASIL',
            ...(empresa.telefone ? { fone: digits(empresa.telefone) } : {}),
          },
          IE: digits(empresa.inscricao_estadual) || 'ISENTO',
          CRT: empresa.regime_tributario || 1,
        },
        dest: destTag,
        det: detArray,
        total: {
          ICMSTot: {
            vBC: dec(vBC, 2),
            vICMS: dec(vICMS, 2),
            vICMSDeson: '0.00',
            vFCPUFDest: '0.00',
            vICMSUFDest: '0.00',
            vICMSUFRemet: '0.00',
            vFCP: '0.00',
            vBCST: '0.00',
            vST: '0.00',
            vFCPST: '0.00',
            vFCPSTRet: '0.00',
            vProd: dec(vProd, 2),
            vFrete: '0.00',
            vSeg: '0.00',
            vDesc: '0.00',
            vII: '0.00',
            vIPI: '0.00',
            vIPIDevol: '0.00',
            vPIS: dec(vPIS, 2),
            vCOFINS: dec(vCOFINS, 2),
            vOutro: '0.00',
            vNF: dec(vNF, 2),
          },
        },
        transp: {
          modFrete: 9,
        },
        pag: {
          detPag: {
            indPag: 0,
            tPag: '01',
            vPag: dec(vNF, 2),
          },
        },
        infAdic: {
          infCpl: `Documento gerado pelo sistema de gestao.`,
        },
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: false,
    suppressEmptyNode: false,
    suppressBooleanAttributes: false,
  });

  const xmlBody = builder.build(nfeObj);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>${xmlBody}`;

  return { xml, chaveAcesso, infNFeId };
}
