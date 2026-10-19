import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { lotes as lotesTable, quadras } from "@/db/schema";
import {
  exigirPerfil,
  PERFIS_DE_ESCRITA,
  requireAuth,
} from "@/lib/auth";
import { ApiError, toErroResponse } from "@/lib/errors";
import { normalizarQuadra } from "@/lib/validacao";

export async function GET() {
  try {
    const resultado = await db
      .select({
        id: quadras.id,
        nome: quadras.nome,
        totalLotes: sql<number>`(
          select count(*)::int from ${lotesTable}
          where ${lotesTable.quadraId} = ${quadras.id}
        )`,
      })
      .from(quadras)
      .orderBy(asc(quadras.nome));

    return Response.json(resultado);
  } catch (error) {
    return toErroResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessao = await requireAuth(request);
    exigirPerfil(sessao, ...PERFIS_DE_ESCRITA);

    const corpo = (await request.json().catch(() => ({}))) as { nome?: unknown };
    const nome = normalizarQuadra(corpo.nome);

    const existente = await db
      .select({ id: quadras.id })
      .from(quadras)
      .where(eq(quadras.nome, nome))
      .limit(1);

    if (existente.length > 0) {
      throw new ApiError(409, `Já existe a quadra ${nome}.`);
    }

    const [quadra] = await db
      .insert(quadras)
      .values({ nome })
      .returning({ id: quadras.id, nome: quadras.nome });

    return Response.json(quadra, { status: 201 });
  } catch (error) {
    return toErroResponse(error);
  }
}
