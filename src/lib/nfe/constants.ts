// Códigos IBGE das UFs
export const UF_IBGE: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53',
  ES: '32', GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15',
  PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43',
  RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17',
};

export const IBGE_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_IBGE).map(([uf, cod]) => [cod, uf])
);

// Autorizadores por UF — define qual webservice cada estado usa
type Autorizador = 'AM' | 'BA' | 'GO' | 'MG' | 'MS' | 'MT' | 'PE' | 'PR' | 'RS' | 'SP' | 'SVRS' | 'SVAN';

const UF_AUTORIZADOR: Record<string, Autorizador> = {
  AC: 'SVRS', AL: 'SVRS', AP: 'SVRS', AM: 'AM', BA: 'BA', CE: 'SVRS',
  DF: 'SVRS', ES: 'SVRS', GO: 'GO', MA: 'SVAN', MG: 'MG', MS: 'MS',
  MT: 'MT', PA: 'SVAN', PB: 'SVRS', PE: 'PE', PI: 'SVAN', PR: 'PR',
  RJ: 'SVRS', RN: 'SVRS', RO: 'SVRS', RR: 'SVRS', RS: 'RS', SC: 'SVRS',
  SE: 'SVRS', SP: 'SP', TO: 'SVRS',
};

// Endpoints SEFAZ por autorizador e ambiente
interface SefazEndpoints {
  autorizacao: string;
  retAutorizacao: string;
  consultaProtocolo: string;
  inutilizacao: string;
  recepcaoEvento: string;
}

const ENDPOINTS_HOMOLOGACAO: Record<Autorizador, SefazEndpoints> = {
  AM: {
    autorizacao: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
    retAutorizacao: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeRetAutorizacao4',
    consultaProtocolo: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
    inutilizacao: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeInutilizacao4',
    recepcaoEvento: 'https://homnfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4',
  },
  BA: {
    autorizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    inutilizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeInutilizacao4/NFeInutilizacao4.asmx',
    recepcaoEvento: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
  GO: {
    autorizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
    retAutorizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4',
    consultaProtocolo: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
    inutilizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeInutilizacao4',
    recepcaoEvento: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
  },
  MG: {
    autorizacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
    retAutorizacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4',
    consultaProtocolo: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
    inutilizacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4',
    recepcaoEvento: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/RecepcaoEvento4',
  },
  MS: {
    autorizacao: 'https://homologacao.nfe.ms.gov.br/ws/NFeAutorizacao4',
    retAutorizacao: 'https://homologacao.nfe.ms.gov.br/ws/NFeRetAutorizacao4',
    consultaProtocolo: 'https://homologacao.nfe.ms.gov.br/ws/NFeConsultaProtocolo4',
    inutilizacao: 'https://homologacao.nfe.ms.gov.br/ws/NFeInutilizacao4',
    recepcaoEvento: 'https://homologacao.nfe.ms.gov.br/ws/NFeRecepcaoEvento4',
  },
  MT: {
    autorizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    retAutorizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4',
    consultaProtocolo: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
    inutilizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4',
    recepcaoEvento: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRecepcaoEvento4',
  },
  PE: {
    autorizacao: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4',
    retAutorizacao: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4',
    consultaProtocolo: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeConsulta4',
    inutilizacao: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeInutilizacao4',
    recepcaoEvento: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/RecepcaoEvento4',
  },
  PR: {
    autorizacao: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
    retAutorizacao: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4',
    consultaProtocolo: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
    inutilizacao: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4',
    recepcaoEvento: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4',
  },
  RS: {
    autorizacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    inutilizacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeInutilizacao/NfeInutilizacao4.asmx',
    recepcaoEvento: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  },
  SP: {
    autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    retAutorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
    consultaProtocolo: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    inutilizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
    recepcaoEvento: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
  },
  SVRS: {
    autorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    inutilizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    recepcaoEvento: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  },
  SVAN: {
    autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    inutilizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeInutilizacao4/NFeInutilizacao4.asmx',
    recepcaoEvento: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
};

const ENDPOINTS_PRODUCAO: Record<Autorizador, SefazEndpoints> = {
  AM: {
    autorizacao: 'https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
    retAutorizacao: 'https://nfe.sefaz.am.gov.br/services2/services/NfeRetAutorizacao4',
    consultaProtocolo: 'https://nfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
    inutilizacao: 'https://nfe.sefaz.am.gov.br/services2/services/NfeInutilizacao4',
    recepcaoEvento: 'https://nfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4',
  },
  BA: {
    autorizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    inutilizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeInutilizacao4/NFeInutilizacao4.asmx',
    recepcaoEvento: 'https://nfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
  GO: {
    autorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
    retAutorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4',
    consultaProtocolo: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
    inutilizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeInutilizacao4',
    recepcaoEvento: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
  },
  MG: {
    autorizacao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
    retAutorizacao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4',
    consultaProtocolo: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
    inutilizacao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4',
    recepcaoEvento: 'https://nfe.fazenda.mg.gov.br/nfe2/services/RecepcaoEvento4',
  },
  MS: {
    autorizacao: 'https://nfe.fazenda.ms.gov.br/ws/NFeAutorizacao4',
    retAutorizacao: 'https://nfe.fazenda.ms.gov.br/ws/NFeRetAutorizacao4',
    consultaProtocolo: 'https://nfe.fazenda.ms.gov.br/ws/NFeConsultaProtocolo4',
    inutilizacao: 'https://nfe.fazenda.ms.gov.br/ws/NFeInutilizacao4',
    recepcaoEvento: 'https://nfe.fazenda.ms.gov.br/ws/NFeRecepcaoEvento4',
  },
  MT: {
    autorizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    retAutorizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4',
    consultaProtocolo: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
    inutilizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4',
    recepcaoEvento: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRecepcaoEvento4',
  },
  PE: {
    autorizacao: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4',
    retAutorizacao: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4',
    consultaProtocolo: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsulta4',
    inutilizacao: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeInutilizacao4',
    recepcaoEvento: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/RecepcaoEvento4',
  },
  PR: {
    autorizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
    retAutorizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4',
    consultaProtocolo: 'https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
    inutilizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4',
    recepcaoEvento: 'https://nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4',
  },
  RS: {
    autorizacao: 'https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://nfe.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    inutilizacao: 'https://nfe.sefazrs.rs.gov.br/ws/NfeInutilizacao/NfeInutilizacao4.asmx',
    recepcaoEvento: 'https://nfe.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  },
  SP: {
    autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
    consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    inutilizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
    recepcaoEvento: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
  },
  SVRS: {
    autorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    inutilizacao: 'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    recepcaoEvento: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  },
  SVAN: {
    autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    inutilizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeInutilizacao4/NFeInutilizacao4.asmx',
    recepcaoEvento: 'https://www.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
};

export function getSefazEndpoints(uf: string, ambiente: number): SefazEndpoints {
  const autorizador = UF_AUTORIZADOR[uf];
  if (!autorizador) throw new Error(`UF não suportada: ${uf}`);
  const map = ambiente === 1 ? ENDPOINTS_PRODUCAO : ENDPOINTS_HOMOLOGACAO;
  return map[autorizador];
}

export function getCodigoUF(uf: string): string {
  const cod = UF_IBGE[uf];
  if (!cod) throw new Error(`UF inválida: ${uf}`);
  return cod;
}
