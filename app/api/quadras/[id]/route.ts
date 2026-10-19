import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { falecidos, lotes as lotesTable, quadras } from "@/db/schema";
import {
  exigirPerfil,
  PERFIS_DE_ESCRITA,
  requireAuth,
} from "@/lib/auth";
import { ApiError, toErroResponse } from "@/lib/errors";
import { exigirUuid } from "@/lib/uuid";
import { normalizarQuadra } from "@/lib/validacao";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/quadras/[id]">,
) {
  try {
    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Quadra");

    const [quadra] = await db
      .select({ id: quadras.id, nome: quadras.nome })
      .from(quadras)
      .where(eq(quadras.id, id))
      .limit(1);

    if (!quadra) {
      throw new ApiError(404, "Quadra não encontrada.");
    }

    return Response.json(quadra);
  } catch (error) {
    return toErroResponse(error);
  }
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/quadras/[id]">,
) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Quadra");
    const corpo = (await request.json().catch(() => ({}))) as { nome?: unknown };
    const nome = normalizarQuadra(corpo.nome);

    const [existente] = await db
      .select({ id: quadras.id, nome: quadras.nome })
      .from(quadras)
      .where(eq(quadras.id, id))
      .limit(1);

    if (!existente) {
      throw new ApiError(404, "Quadra não encontrada.");
    }

    if (existente.nome === nome) {
      return Response.json({ id: existente.id, nome: existente.nome });
    }

    const conflito = await db
      .select({ id: quadras.id })
      .from(quadras)
      .where(eq(quadras.nome, nome))
      .limit(1);

    if (conflito.length > 0) {
      throw new ApiError(409, `Já existe a quadra ${nome}.`);
    }

    const [quadra] = await db
      .update(quadras)
      .set({ nome })
      .where(eq(quadras.id, id))
      .returning({ id: quadras.id, nome: quadras.nome });

    return Response.json(quadra);
  } catch (error) {
    return toErroResponse(error);
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/quadras/[id]">,
) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const { id: idBruto } = await ctx.params;
    const id = exigirUuid(idBruto, "Quadra");

    const [quadra] = await db
      .select({ id: quadras.id, nome: quadras.nome })
      .from(quadras)
      .where(eq(quadras.id, id))
      .limit(1);

    if (!quadra) {
      throw new ApiError(404, "Quadra não encontrada.");
    }

    const removidos = await db.transaction(async (tx) => {
      const lotesDaQuadra = await tx
        .select({ id: lotesTable.id })
        .from(lotesTable)
        .where(eq(lotesTable.quadraId, id));

const idsLotes = lotesDaQuadra.map((lote) => lote.id);
      let falecidosRemovidos = 0;

      if (idsLotes.length > 0) {
        const vinculados = await tx
          .select({ id: falecidos.id })
          .from(falecidos)
          .where(inArray(falecidos.loteId, idsLotes));

        falecidosRemovidos = vinculados.length;

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

        await tx.delete(lotesTable).where(inArray(lotesTable.id, idsLotes));
      }

      await tx.delete(quadras).where(eq(quadras.id, id));

      return {
        falecidosRemovidos,
        lotesRemovidos: idsLotes.length,
      };
    });

    return Response.json({
      mensagem: `Quadra ${quadra.nome} removida com sucesso.`,
      quadrasRemovidas: 1,
      lotesRemovidos: removidos.lotesRemovidos,
      falecidosRemovidos: removidos.falecidosRemovidos,
    });
  } catch (error) {
    return toErroResponse(error);
  }
}
