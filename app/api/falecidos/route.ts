import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { falecidos, lotes as lotesTable, quadras } from "@/db/schema";
import {
  exigirPerfil,
  PERFIS_DE_ESCRITA,
  requireAuth,
} from "@/lib/auth";
import { ApiError, toErroResponse } from "@/lib/errors";
import {
  falecidoSelect,
  listarFalecidos,
  normalizarData,
  normalizarTipo,
  resolverLote,
  textoOpcional,
  toFalecidoDTO,
} from "@/lib/falecido";
import {
  extrairArquivosDeFormulario,
  salvarUpload,
  salvarUploads,
} from "@/lib/upload";
import { ehUuid } from "@/lib/uuid";

export async function GET(request: NextRequest) {
  try {
    const loteId = request.nextUrl.searchParams.get("loteId");
    const quadraId = request.nextUrl.searchParams.get("quadraId");

    if (loteId && !ehUuid(loteId)) {
      return Response.json({ erro: "Identificador de lote inválido." }, { status: 400 });
    }

    if (quadraId && !ehUuid(quadraId)) {
      return Response.json({ erro: "Identificador de quadra inválido." }, { status: 400 });
    }

    const memoriais = await listarFalecidos({
      loteId: loteId ?? undefined,
      quadraId: quadraId ?? undefined,
    });

    return Response.json(memoriais.map(toFalecidoDTO));
  } catch (error) {
    return toErroResponse(error);
  }
}

type Entrada = Record<string, unknown>;

type Payload = {
  entradas: Entrada;
  // FormData original, quando a requisicao veio como multipart. O corpo do
  // request so pode ser lido uma vez, por isso guardamos aqui.
  form: FormData | null;
};

async function lerPayload(request: Request): Promise<Payload> {
  const tipo = request.headers.get("content-type") ?? "";

  if (tipo.includes("multipart/form-data")) {
    const form = await request.formData();
    const entradas: Entrada = {};

    for (const [chave, valor] of form.entries()) {
      // campos repetidos (galeria[]) viram array
      if (chave in entradas) {
        const atual = entradas[chave];
        entradas[chave] = Array.isArray(atual) ? [...atual, valor] : [atual, valor];
      } else {
        entradas[chave] = valor;
      }
    }

    return { entradas, form };
  }

  const json = await request.json().catch(() => ({}));

  if (typeof json !== "object" || json === null) {
    throw new ApiError(400, "Corpo da requisição inválido.");
  }

  return { entradas: json as Entrada, form: null };
}

function listaDeUrls(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.filter((item): item is string => typeof item === "string");
  }

  if (typeof valor === "string" && valor.trim()) {
    return [valor.trim()];
  }

  return [];
}

async function resolverImagem(form: FormData | null, entradas: Entrada) {
  if (!form) {
    return textoOpcional(entradas.imagem) ?? null;
  }

  const arquivos = await extrairArquivosDeFormulario(form, "imagem");

  if (arquivos.length === 0) {
    return textoOpcional(entradas.imagem) ?? null;
  }

  return salvarUpload(arquivos[0]);
}

async function resolverGaleria(form: FormData | null, entradas: Entrada) {
  if (!form) {
    return listaDeUrls(entradas.galeria);
  }

  const arquivos = await extrairArquivosDeFormulario(form, "galeria");

  if (arquivos.length === 0) {
    return listaDeUrls(entradas.galeria);
  }

  return salvarUploads(arquivos);
}

export async function POST(request: Request) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const { entradas, form } = await lerPayload(request);

    const loteId = await resolverLote({
      quadraId: (entradas.quadraId as string) ?? null,
      loteId: (entradas.loteId as string) ?? null,
      localizacao: (entradas.localizacao as string) ?? null,
    });

    const imagemUrl = await resolverImagem(form, entradas);
    const galeria = await resolverGaleria(form, entradas);

    const [criado] = await db
      .insert(falecidos)
      .values({
        nome: (textoOpcional(entradas.nome) ?? "").slice(0, 255),
        biografia: textoOpcional(entradas.biografia) ?? null,
        mensagemFamilia: textoOpcional(entradas.mensagemFamilia) ?? null,
        dataNascimento:
          normalizarData(entradas.dataNascimento, "Data de nascimento") ?? null,
        dataMorte: normalizarData(entradas.dataMorte, "Data de falecimento") ?? null,
        tipo: normalizarTipo(entradas.tipo),
        imagemUrl,
        galeria,
        loteId,
      })
      .returning({ id: falecidos.id });

    const completo = await db
      .select(falecidoSelect)
      .from(falecidos)
      .innerJoin(lotesTable, eq(falecidos.loteId, lotesTable.id))
      .innerJoin(quadras, eq(lotesTable.quadraId, quadras.id))
      .where(eq(falecidos.id, criado.id))
      .limit(1);

    return Response.json(toFalecidoDTO(completo[0]), { status: 201 });
  } catch (error) {
    return toErroResponse(error);
  }
}