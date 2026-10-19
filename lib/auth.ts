import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "./errors";

const ALGORITHM = "HS256";
const EXPIRA_EM = "7d";

export type Role = "ADMIN" | "ATENDENTE" | "VISITANTE";

export type Sessao = {
  id: string;
  nome: string;
  email: string;
  role: Role;
};

function segredo(): Uint8Array {
  const valor = process.env.AUTH_SECRET;

  if (!valor) {
    throw new Error("AUTH_SECRET não definida. Configure no .env.");
  }

  return new TextEncoder().encode(valor);
}

export async function gerarToken(sessao: Sessao): Promise<string> {
  return new SignJWT({
    nome: sessao.nome,
    email: sessao.email,
    role: sessao.role,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(sessao.id)
    .setIssuedAt()
    .setExpirationTime(EXPIRA_EM)
    .sign(segredo());
}

export async function verificarToken(token: string): Promise<Sessao> {
  const { payload } = await jwtVerify(token, segredo(), {
    algorithms: [ALGORITHM],
  });

  if (!payload.sub) {
    throw new ApiError(401, "Sessão inválida ou expirada.");
  }

  return {
    id: payload.sub,
    nome: String(payload.nome ?? ""),
    email: String(payload.email ?? ""),
    role: (payload.role as Role) ?? "VISITANTE",
  };
}

export async function requireAuth(request: Request): Promise<Sessao> {
  const header = request.headers.get("authorization");

  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    throw new ApiError(401, "Token de acesso ausente.");
  }

  const token = header.slice(7).trim();

  try {
    return await verificarToken(token);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, "Sessão inválida ou expirada.");
  }
}

export function exigirPerfil(sessao: Sessao, ...perfis: Role[]): void {
  if (!perfis.includes(sessao.role)) {
    throw new ApiError(403, "Acesso não autorizado para esta operação.");
  }
}

export const PERFIS_DE_ESCRITA: Role[] = ["ADMIN", "ATENDENTE"];