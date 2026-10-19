import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { falecidos, lotes as lotesTable, quadras } from "@/db/schema";
import { parseBR, fmtBR, paraISO } from "./data";
import { ApiError } from "./errors";
import { ehUuid } from "./uuid";

export const falecidoSelect = {
  id: falecidos.id,
  nome: falecidos.nome,
  dataNascimento: falecidos.dataNascimento,
  dataMorte: falecidos.dataMorte,
  tipo: falecidos.tipo,
  biografia: falecidos.biografia,
  mensagemFamilia: falecidos.mensagemFamilia,
  imagemUrl: falecidos.imagemUrl,
  galeria: falecidos.galeria,
  createdAt: falecidos.createdAt,
  loteId: lotesTable.id,
  loteNumero: lotesTable.numero,
  quadraId: quadras.id,
  quadraNome: quadras.nome,
};

export type FalecidoComRelacoes = {
  id: string;
  nome: string;
  dataNascimento: string | null;
  dataMorte: string | null;
  tipo: "HISTORICA" | "RECENTE";
  biografia: string | null;
  mensagemFamilia: string | null;
  imagemUrl: string | null;
  galeria: unknown;
  createdAt: Date;
  loteId: string;
  loteNumero: string;
  quadraId: string;
  quadraNome: string;
};

export function toFalecidoDTO(memorial: FalecidoComRelacoes) {
  return {
    id: memorial.id,
    nome: memorial.nome,
    biografia: memorial.biografia,
    descricao: memorial.biografia,
    dataNascimento: fmtBR(memorial.dataNascimento),
    dataMorte: fmtBR(memorial.dataMorte),
    localizacao: `Quadra ${memorial.quadraNome}, Lote ${memorial.loteNumero}`,
    loteId: memorial.loteId,
    quadraId: memorial.quadraId,
    tipo: memorial.tipo === "HISTORICA" ? "historica" : "recente",
    imagem: memorial.imagemUrl,
    galeria: normalizarGaleria(memorial.galeria),
    mensagemFamilia: memorial.mensagemFamilia,
    createdAt: memorial.createdAt.toISOString(),
  };
}

export function normalizarGaleria(valor: unknown): string[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.filter((item): item is string => typeof item === "string");
}

export async function listarFalecidos(filtros?: {
  loteId?: string;
  quadraId?: string;
}): Promise<FalecidoComRelacoes[]> {
  const condicoes: SQL[] = [];

  if (filtros?.loteId) {
    condicoes.push(eq(falecidos.loteId, filtros.loteId));
  }

  if (filtros?.quadraId) {
    condicoes.push(eq(lotesTable.quadraId, filtros.quadraId));
  }

  const consulta = db
    .select(falecidoSelect)
    .from(falecidos)
    .innerJoin(lotesTable, eq(falecidos.loteId, lotesTable.id))
    .innerJoin(quadras, eq(lotesTable.quadraId, quadras.id))
    .orderBy(desc(falecidos.createdAt));

  if (condicoes.length === 0) {
    return await consulta;
  }

  return await consulta.where(and(...condicoes));
}

export async function buscarFalecido(
  id: string,
): Promise<FalecidoComRelacoes | undefined> {
  const [memorial] = await db
    .select(falecidoSelect)
    .from(falecidos)
    .innerJoin(lotesTable, eq(falecidos.loteId, lotesTable.id))
    .innerJoin(quadras, eq(lotesTable.quadraId, quadras.id))
    .where(eq(falecidos.id, id))
    .limit(1);

  return memorial;
}

const REGEX_LOCALIZACAO = /^Quadra\s+(.+?)\s*,\s*Lote\s+(.+)$/i;

/**
 * Resolve o lote de destino aceitando os ids (forma preferida) ou a string
 * "Quadra X, Lote Y" (formato que o formulario em texto livre ainda envia).
 *
 * Regra: quadra e lote precisam existir. Nao criamos nada implicitamente.
 */
export async function resolverLote(dados: {
  quadraId?: string | null;
  loteId?: string | null;
  localizacao?: string | null;
}): Promise<string> {
  if (dados.loteId && ehUuid(dados.loteId)) {
    const [lote] = await db
      .select({ id: lotesTable.id, quadraId: lotesTable.quadraId })
      .from(lotesTable)
      .where(eq(lotesTable.id, dados.loteId))
      .limit(1);

    if (!lote) {
      throw new ApiError(400, "O lote informado não existe.");
    }

    if (dados.quadraId && ehUuid(dados.quadraId) && lote.quadraId !== dados.quadraId) {
      throw new ApiError(400, "O lote informado não pertence à quadra informada.");
    }

    return lote.id;
  }

  const texto = (dados.localizacao ?? "").trim();

  if (!texto) {
    throw new ApiError(400, "Informe a quadra e o lote do falecido.");
  }

  const partes = texto.match(REGEX_LOCALIZACAO);

  if (!partes) {
    throw new ApiError(
      400,
      'Localização inválida. Use o formato "Quadra A, Lote 42".',
    );
  }

  const nomeQuadra = partes[1].trim().toUpperCase();
  const numeroLote = partes[2].trim();

  const [quadra] = await db
    .select({ id: quadras.id, nome: quadras.nome })
    .from(quadras)
    .where(eq(quadras.nome, nomeQuadra))
    .limit(1);

  if (!quadra) {
    throw new ApiError(
      400,
      `A quadra ${nomeQuadra} não existe. Cadastre-a em "Quadras e Lotes" antes.`,
    );
  }

  const lotesDaQuadra = await db
    .select({ id: lotesTable.id, numero: lotesTable.numero })
    .from(lotesTable)
    .where(eq(lotesTable.quadraId, quadra.id))
    .orderBy(asc(lotesTable.numero));

  const lote = lotesDaQuadra.find(
    (item) => item.numero.toLowerCase() === numeroLote.toLowerCase(),
  );

  if (!lote) {
    throw new ApiError(
      400,
      `O lote ${numeroLote} não existe na quadra ${quadra.nome}. Cadastre-o antes.`,
    );
  }

  return lote.id;
}

export function normalizarTipo(valor: unknown): "HISTORICA" | "RECENTE" {
  const texto = typeof valor === "string" ? valor.trim().toLowerCase() : "";

  if (texto === "historica" || texto === "historico") {
    return "HISTORICA";
  }

  if (texto === "recente") {
    return "RECENTE";
  }

  return "RECENTE";
}

export function normalizarData(
  valor: unknown,
  campo: string,
): string | null | undefined {
  if (valor === undefined) {
    return undefined;
  }

  const texto = typeof valor === "string" ? valor.trim() : "";

  if (!texto) {
    return null;
  }

  const data = parseBR(texto);

  if (!data) {
    throw new ApiError(400, `${campo} inválida. Use o formato dd/mm/aaaa.`);
  }

  return paraISO(data);
}

export function textoOpcional(valor: unknown): string | null | undefined {
  if (valor === undefined) {
    return undefined;
  }

  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();

  return texto || null;
}