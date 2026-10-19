import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { gerarToken, type Role } from "@/lib/auth";
import { ApiError, toErroResponse } from "@/lib/errors";
import { verificarSenha } from "@/lib/password";
import {
  estaBloqueado,
  limparFalhas,
  registrarFalha,
} from "@/lib/rate-limit";

function ipDe(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "desconhecido";
}

export async function POST(request: Request) {
  try {
    let corpo: unknown;

    try {
      corpo = await request.json();
    } catch {
      throw new ApiError(400, "Corpo da requisição inválido. Envie JSON.");
    }

    const email =
      typeof (corpo as { email?: unknown })?.email === "string"
        ? String((corpo as { email: string }).email).trim().toLowerCase()
        : "";
    const password =
      typeof (corpo as { password?: unknown })?.password === "string"
        ? String((corpo as { password: string }).password)
        : "";

    if (!email || !password) {
      throw new ApiError(400, "Informe e-mail e senha.");
    }

    const chave = `${ipDe(request)}:${email}`;

    if (estaBloqueado(chave)) {
      throw new ApiError(
        429,
        "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
      );
    }

    const [usuario] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!usuario || !verificarSenha(password, usuario.passwordHash)) {
      registrarFalha(chave);
      throw new ApiError(401, "As credenciais informadas estão incorretas.");
    }

    limparFalhas(chave);

    const sessao = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role as Role,
    };

    const token = await gerarToken(sessao);

    return Response.json({
      token,
      user: {
        id: sessao.id,
        nome: sessao.nome,
        email: sessao.email,
        role: sessao.role,
      },
    });
  } catch (error) {
    return toErroResponse(error);
  }
}