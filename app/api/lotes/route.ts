import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { lotes as lotesTable, quadras } from "@/db/schema";
import {
  exigirPerfil,
  PERFIS_DE_ESCRITA,
  requireAuth,
} from "@/lib/auth";
import { ApiError, toErroResponse } from "@/lib/errors";
import { exigirUuid } from "@/lib/uuid";
import { normalizarLote } from "@/lib/validacao";

export async function GET(request: NextRequest) {
  try {
    const quadraId = request.nextUrl.searchParams.get("quadraId");

    const consulta = db
      .select({
        id: lotesTable.id,
        quadraId: lotesTable.quadraId,
        numero: lotesTable.numero,
        quadraNome: quadras.nome,
      })
      .from(lotesTable)
      .innerJoin(quadras, eq(lotesTable.quadraId, quadras.id))
      .orderBy(asc(lotesTable.numero));

    const resultado = quadraId
      ? await consulta.where(eq(lotesTable.quadraId, exigirUuid(quadraId, "Quadra")))
      : await consulta;

    return Response.json(resultado);
  } catch (error) {
    return toErroResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const corpo = (await request.json().catch(() => ({}))) as {
      quadraId?: unknown;
      numero?: unknown;
    };

    const quadraId =
      typeof corpo.quadraId === "string" ? corpo.quadraId.trim() : "";

    if (!quadraId) {
      throw new ApiError(400, "Informe a quadra do lote.");
    }

    const numero = normalizarLote(corpo.numero);

    const [quadra] = await db
      .select({ id: quadras.id })
      .from(quadras)
      .where(eq(quadras.id, quadraId))
      .limit(1);

    if (!quadra) {
      throw new ApiError(404, "Quadra não encontrada.");
    }

    const existente = await db
      .select({ id: lotesTable.id, numero: lotesTable.numero })
      .from(lotesTable)
      .where(eq(lotesTable.quadraId, quadraId));

    const duplicado = existente.find(
      (lote) => lote.numero.toLowerCase() === numero.toLowerCase(),
    );

    if (duplicado) {
      throw new ApiError(409, `Já existe o lote ${numero} nesta quadra.`);
    }

    const [lote] = await db
      .insert(lotesTable)
      .values({ quadraId, numero })
      .returning({
        id: lotesTable.id,
        quadraId: lotesTable.quadraId,
        numero: lotesTable.numero,
      });

    return Response.json(lote, { status: 201 });
  } catch (error) {
    return toErroResponse(error);
  }
}
