import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { falecidos, lotes as lotesTable, quadras } from "@/db/schema";
import {
  exigirPerfil,
  PERFIS_DE_ESCRITA,
  requireAuth,
} from "@/lib/auth";
import { ApiError, toErroResponse } from "@/lib/errors";
import { exigirUuid } from "@/lib/uuid";
import { normalizarLote } from "@/lib/validacao";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/lotes/[id]">,
) {
  try {
    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Lote");

    const [lote] = await db
      .select({
        id: lotesTable.id,
        quadraId: lotesTable.quadraId,
        numero: lotesTable.numero,
        quadraNome: quadras.nome,
      })
      .from(lotesTable)
      .innerJoin(quadras, eq(lotesTable.quadraId, quadras.id))
      .where(eq(lotesTable.id, id))
      .limit(1);

    if (!lote) {
      throw new ApiError(404, "Lote não encontrado.");
    }

    return Response.json(lote);
  } catch (error) {
    return toErroResponse(error);
  }
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/lotes/[id]">,
) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Lote");
    const corpo = (await request.json().catch(() => ({}))) as { numero?: unknown };
    const numero = normalizarLote(corpo.numero);

    const [lote] = await db
      .select({
        id: lotesTable.id,
        quadraId: lotesTable.quadraId,
        numero: lotesTable.numero,
      })
      .from(lotesTable)
      .where(eq(lotesTable.id, id))
      .limit(1);

    if (!lote) {
      throw new ApiError(404, "Lote não encontrado.");
    }

    if (lote.numero === numero) {
      return Response.json(lote);
    }

    const existentes = await db
      .select({ id: lotesTable.id, numero: lotesTable.numero })
      .from(lotesTable)
      .where(eq(lotesTable.quadraId, lote.quadraId));

    const duplicado = existentes.find(
      (item) =>
        item.id !== lote.id &&
        item.numero.toLowerCase() === numero.toLowerCase(),
    );

    if (duplicado) {
      throw new ApiError(409, `Já existe o lote ${numero} nesta quadra.`);
    }

    const [atualizado] = await db
      .update(lotesTable)
      .set({ numero })
      .where(eq(lotesTable.id, id))
      .returning({
        id: lotesTable.id,
        quadraId: lotesTable.quadraId,
        numero: lotesTable.numero,
      });

    return Response.json(atualizado);
  } catch (error) {
    return toErroResponse(error);
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/lotes/[id]">,
) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Lote");

    const [lote] = await db
      .select({
        id: lotesTable.id,
        quadraId: lotesTable.quadraId,
        numero: lotesTable.numero,
      })
      .from(lotesTable)
      .where(eq(lotesTable.id, id))
      .limit(1);

    if (!lote) {
      throw new ApiError(404, "Lote não encontrado.");
    }

    const [quadra] = await db
      .select({ nome: quadras.nome })
      .from(quadras)
      .where(eq(quadras.id, lote.quadraId))
      .limit(1);

const removidos = await db.transaction(async (tx) => {
      const vinculados = await tx
        .select({ id: falecidos.id })
        .from(falecidos)
        .where(eq(falecidos.loteId, id));

      if (vinculados.length > 0) {
        await tx
          .delete(falecidos)
          .where(
            inArray(
              falecidos.id,
              vinculados.map((registro) => registro.id),
            ),
          );
      }

      await tx.delete(lotesTable).where(eq(lotesTable.id, id));

      return { falecidosRemovidos: vinculados.length };
    });

    return Response.json({
      mensagem: `Lote ${lote.numero} removido com sucesso.`,
      lotesRemovidos: 1,
      falecidosRemovidos: removidos.falecidosRemovidos,
      quadra: quadra?.nome ?? null,
    });
  } catch (error) {
    return toErroResponse(error);
  }
}
