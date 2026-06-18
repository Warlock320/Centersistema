import crypto from 'crypto';
import forge from 'node-forge';

export interface CertificateData {
  privateKeyPem: string;
  certificatePem: string;
  certificateDer: Buffer;
  pfxBuffer: Buffer;
  password: string;
}

export function extractCertificate(pfxBuffer: Buffer, password: string): CertificateData {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

  if (!certBag?.cert || !keyBag?.key) {
    throw new Error('Certificado ou chave privada não encontrados no arquivo PFX.');
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
  const certificatePem = forge.pki.certificateToPem(certBag.cert);
  const certDerStr = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert)).getBytes();
  const certificateDer = Buffer.from(certDerStr, 'binary');

  return { privateKeyPem, certificatePem, certificateDer, pfxBuffer, password };
}

export function signNfeXml(xml: string, certData: CertificateData): string {
  // 1. Extrair o conteúdo de <infNFe ...>...</infNFe>
  const infNFeMatch = xml.match(/<infNFe[^>]*>[\s\S]*?<\/infNFe>/);
  if (!infNFeMatch) throw new Error('Tag <infNFe> não encontrada no XML.');
  const infNFeContent = infNFeMatch[0];

  // 2. Extrair o Id da infNFe
  const idMatch = infNFeContent.match(/Id="([^"]+)"/);
  if (!idMatch) throw new Error('Atributo Id não encontrado na tag infNFe.');
  const uri = idMatch[1];

  // 3. Canonicalizar infNFe (C14N simplificado — o XML já é gerado sem whitespace extra)
  const c14nInfNFe = infNFeContent;

  // 4. Calcular digest SHA-1 do infNFe canonicalizado
  const digestValue = crypto
    .createHash('sha1')
    .update(c14nInfNFe, 'utf8')
    .digest('base64');

  // 5. Montar SignedInfo
  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${uri}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  // 6. Assinar SignedInfo com RSA-SHA1
  const signer = crypto.createSign('RSA-SHA1');
  signer.update(signedInfo);
  const signatureValue = signer.sign(certData.privateKeyPem, 'base64');

  // 7. X509Certificate em base64 (DER)
  const x509Cert = certData.certificateDer.toString('base64');

  // 8. Montar elemento Signature
  const signatureElement =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo>` +
    `<X509Data>` +
    `<X509Certificate>${x509Cert}</X509Certificate>` +
    `</X509Data>` +
    `</KeyInfo>` +
    `</Signature>`;

  // 9. Inserir Signature dentro de infNFe (antes do </infNFe>)
  const signedXml = xml.replace('</infNFe>', `${signatureElement}</infNFe>`);

  return signedXml;
}
