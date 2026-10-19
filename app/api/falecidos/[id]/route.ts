import { eq } from "drizzle-orm";
import { db } from "@/db";
import { falecidos } from "@/db/schema";
import {
  exigirPerfil,
  PERFIS_DE_ESCRITA,
  requireAuth,
} from "@/lib/auth";
import { ApiError, toErroResponse } from "@/lib/errors";
import {
  buscarFalecido,
  normalizarData,
  normalizarTipo,
  resolverLote,
  textoOpcional,
  toFalecidoDTO,
} from "@/lib/falecido";
import {
  extrairArquivosDeFormulario,
  objetoDoBucket,
  removerUpload,
  salvarUpload,
  salvarUploads,
} from "@/lib/upload";
import { exigirUuid } from "@/lib/uuid";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/falecidos/[id]">,
) {
  try {
    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Falecido");

    const memorial = await buscarFalecido(id);

    if (!memorial) {
      throw new ApiError(404, "Falecido não encontrado.");
    }

    return Response.json(toFalecidoDTO(memorial));
  } catch (error) {
    return toErroResponse(error);
  }
}

type Entrada = Record<string, unknown>;

async function lerPayload(request: Request) {
  const tipo = request.headers.get("content-type") ?? "";

  if (tipo.includes("multipart/form-data")) {
    const form = await request.formData();
    const entradas: Entrada = {};

    for (const [chave, valor] of form.entries()) {
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

  return { entradas: json as Entrada, form: null as FormData | null };
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

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/falecidos/[id]">,
) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Falecido");

    const atual = await buscarFalecido(id);

    if (!atual) {
      throw new ApiError(404, "Falecido não encontrado.");
    }

    const { entradas, form } = await lerPayload(request);

    const valores: Record<string, unknown> = {};

    if ("nome" in entradas) {
      valores.nome = (textoOpcional(entradas.nome) ?? "").slice(0, 255);
    }

    if ("biografia" in entradas) {
      valores.biografia = textoOpcional(entradas.biografia) ?? null;
    }

    if ("mensagemFamilia" in entradas) {
      valores.mensagemFamilia = textoOpcional(entradas.mensagemFamilia) ?? null;
    }

    const nascimento = normalizarData(
      entradas.dataNascimento,
      "Data de nascimento",
    );
    if (nascimento !== undefined) valores.dataNascimento = nascimento;

    const morte = normalizarData(entradas.dataMorte, "Data de falecimento");
    if (morte !== undefined) valores.dataMorte = morte;

    if ("tipo" in entradas) {
      valores.tipo = normalizarTipo(entradas.tipo);
    }

    // So mexe na localizacao se o cliente mandou algum identificador
    if (
      "localizacao" in entradas ||
      "quadraId" in entradas ||
      "loteId" in entradas
    ) {
      valores.loteId = await resolverLote({
        quadraId: (entradas.quadraId as string) ?? null,
        loteId: (entradas.loteId as string) ?? null,
        localizacao: (entradas.localizacao as string) ?? null,
      });
    }

    let imagemSubstituida = false;

    if (form) {
      const arquivos = await extrairArquivosDeFormulario(form, "imagem");

      if (arquivos.length > 0) {
        valores.imagemUrl = await salvarUpload(arquivos[0]);
        imagemSubstituida = true;
      }

      const galeria = await extrairArquivosDeFormulario(form, "galeria");

      if (galeria.length > 0) {
        valores.galeria = await salvarUploads(galeria);
      }
    } else {
      if ("imagem" in entradas) {
        valores.imagemUrl = textoOpcional(entradas.imagem) ?? null;
        imagemSubstituida = true;
      }

      if ("galeria" in entradas) {
        valores.galeria = listaDeUrls(entradas.galeria);
      }
    }

    if (Object.keys(valores).length > 0) {
      await db.update(falecidos).set(valores).where(eq(falecidos.id, id));
    }

    // So remove o arquivo antigo depois que a troca deu certo
    if (imagemSubstituida) {
      await removerUpload(atual.imagemUrl);
    }

    const completo = await buscarFalecido(id);

    return Response.json(toFalecidoDTO(completo!));
  } catch (error) {
    return toErroResponse(error);
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/falecidos/[id]">,
) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Falecido");

    const memorial = await buscarFalecido(id);

    if (!memorial) {
      throw new ApiError(404, "Falecido não encontrado.");
    }

    await db.delete(falecidos).where(eq(falecidos.id, id));

    const galeria = Array.isArray(memorial.galeria)
      ? (memorial.galeria as unknown[]).filter(
          (item): item is string => typeof item === "string",
        )
      : [];

    const urls = [memorial.imagemUrl, ...galeria].filter(
      (url): url is string => typeof url === "string" && objetoDoBucket(url) !== null,
    );

    let arquivosRemovidos = 0;

    for (const url of urls) {
      await removerUpload(url);
      arquivosRemovidos++;
    }

    return Response.json({
      mensagem: `Falecido ${memorial.nome} removido com sucesso.`,
      falecidosRemovidos: 1,
      arquivosRemovidos,
    });
  } catch (error) {
    return toErroResponse(error);
  }
}