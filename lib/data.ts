export function fmtBR(valor: Date | string | null | undefined): string {
  if (!valor) {
    return "";
  }

  if (typeof valor === "string") {
    // "YYYY-MM-DD" do Postgres: sem fuso, formatacao direta
    const partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (partes) {
      return `${partes[3]}/${partes[2]}/${partes[1]}`;
    }
  }

  const data = valor as Date;
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

export function parseBR(valor: string | null | undefined): Date | null {
  if (!valor) {
    return null;
  }

  const limpo = valor.trim();

  if (!limpo) {
    return null;
  }

  // dd/mm/aaaa
  const partes = limpo.split(/[/.\-]/).map((parte) => parte.trim());

  if (partes.length !== 3) {
    return null;
  }

  const [dia, mes, ano] = partes.map(Number);

  if (
    !Number.isInteger(dia) ||
    !Number.isInteger(mes) ||
    !Number.isInteger(ano) ||
    dia < 1 ||
    dia > 31 ||
    mes < 1 ||
    mes > 12 ||
    ano < 1000
  ) {
    return null;
  }

  const data = new Date(ano, mes - 1, dia);

  // Rejeita datas que "rolaram" (ex: 31/02 viraria 03/03)
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return null;
  }

  return data;
}

/**
 * Converte para "YYYY-MM-DD" no fuso local. A coluna date do Postgres nao tem
 * fuso, e o modo string do drizzle espera esse formato na escrita.
 */
export function paraISO(data: Date | null | undefined): string | null {
  if (!data) {
    return null;
  }

  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");

  return `${data.getFullYear()}-${mes}-${dia}`;
}
