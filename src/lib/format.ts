// Helpers de máscara de moeda para inputs (formato brasileiro: 0,00).
// A máscara é de "centavos": o usuário digita só números e eles preenchem
// da direita para a esquerda com 2 casas decimais. Ex: 1099 -> 10,99.

/** Número -> string formatada (vazio quando 0, para mostrar o placeholder). */
export function formatMoedaInput(value: number): string {
  if (!value) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** String digitada -> número (lê só os dígitos como centavos). */
export function parseMoedaInput(str: string): number {
  const d = (str || '').replace(/\D/g, '');
  return d ? parseInt(d, 10) / 100 : 0;
}
