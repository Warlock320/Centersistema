import https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { getSefazEndpoints } from './constants';
import type { CertificateData } from './signer';

export interface SefazResponse {
  cStat: string;
  xMotivo: string;
  protNFe?: {
    infProt: {
      tpAmb: string;
      verAplic: string;
      chNFe: string;
      dhRecbto: string;
      nProt: string;
      digVal: string;
      cStat: string;
      xMotivo: string;
    };
  };
  xmlAutorizada?: string;
}

function soapEnvelope(xmlNfe: string, uf: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
    `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<idLote>${Date.now()}</idLote>` +
    `<indSinc>1</indSinc>` +
    xmlNfe +
    `</enviNFe>` +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

function httpsRequest(url: string, body: string, cert: CertificateData): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options: https.RequestOptions = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
      pfx: cert.pfxBuffer,
      passphrase: cert.password,
      rejectUnauthorized: true,
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout na comunicação com a SEFAZ.')); });
    req.write(body);
    req.end();
  });
}

function parseResponse(soapXml: string): SefazResponse {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    removeNSPrefix: true,
  });

  const parsed = parser.parse(soapXml);

  // Navega pela resposta SOAP até o retEnviNFe
  const body = parsed.Envelope?.Body || parsed['soap:Envelope']?.['soap:Body'] ||
    parsed['soap12:Envelope']?.['soap12:Body'] || {};
  const result = body.nfeResultMsg || body.NFeAutorizacao4Result || {};
  const retEnvi = result.retEnviNFe || result;

  const cStat = String(retEnvi.cStat || '');
  const xMotivo = String(retEnvi.xMotivo || '');

  // Lote processado (cStat 104)
  if (cStat === '104' && retEnvi.protNFe) {
    const infProt = retEnvi.protNFe.infProt || {};
    return {
      cStat,
      xMotivo,
      protNFe: {
        infProt: {
          tpAmb: String(infProt.tpAmb || ''),
          verAplic: String(infProt.verAplic || ''),
          chNFe: String(infProt.chNFe || ''),
          dhRecbto: String(infProt.dhRecbto || ''),
          nProt: String(infProt.nProt || ''),
          digVal: String(infProt.digVal || ''),
          cStat: String(infProt.cStat || ''),
          xMotivo: String(infProt.xMotivo || ''),
        },
      },
    };
  }

  return { cStat, xMotivo };
}

function montarXmlAutorizada(xmlNfeSigned: string, protNFe: SefazResponse['protNFe']): string {
  if (!protNFe) return xmlNfeSigned;
  const infProt = protNFe.infProt;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    xmlNfeSigned.replace(/<\?xml[^?]*\?>/, '') +
    `<protNFe versao="4.00">` +
    `<infProt>` +
    `<tpAmb>${infProt.tpAmb}</tpAmb>` +
    `<verAplic>${infProt.verAplic}</verAplic>` +
    `<chNFe>${infProt.chNFe}</chNFe>` +
    `<dhRecbto>${infProt.dhRecbto}</dhRecbto>` +
    `<nProt>${infProt.nProt}</nProt>` +
    `<digVal>${infProt.digVal}</digVal>` +
    `<cStat>${infProt.cStat}</cStat>` +
    `<xMotivo>${infProt.xMotivo}</xMotivo>` +
    `</infProt>` +
    `</protNFe>` +
    `</nfeProc>`
  );
}

export async function enviarNfeSefaz(
  xmlNfeSigned: string,
  uf: string,
  ambiente: number,
  cert: CertificateData
): Promise<SefazResponse> {
  const endpoints = getSefazEndpoints(uf, ambiente);
  const soap = soapEnvelope(xmlNfeSigned, uf);

  const responseXml = await httpsRequest(endpoints.autorizacao, soap, cert);
  const result = parseResponse(responseXml);

  // Se autorizada (100), monta o XML completo com protocolo
  if (result.protNFe?.infProt.cStat === '100') {
    result.xmlAutorizada = montarXmlAutorizada(xmlNfeSigned, result.protNFe);
  }

  return result;
}
