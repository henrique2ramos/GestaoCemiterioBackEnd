import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ORIGEM_PADRAO = "http://localhost:5000";

function origensPermitidas(): string[] {
  const configurado = process.env.ALLOWED_ORIGINS ?? ORIGEM_PADRAO;

  return configurado
    .split(",")
    .map((origem) => origem.trim())
    .filter(Boolean);
}

const CABECALHOS_CORS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const permitida = origin !== null && origensPermitidas().includes(origin);

  if (request.method === "OPTIONS") {
    const headers = new Headers(CABECALHOS_CORS);

    if (permitida) {
      headers.set("Access-Control-Allow-Origin", origin);
    }

    headers.set("Vary", "Origin");

    return new Response(null, { status: 204, headers });
  }

  const response = NextResponse.next();

  if (permitida) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set("Vary", "Origin");

  for (const [chave, valor] of Object.entries(CABECALHOS_CORS)) {
    response.headers.set(chave, valor);
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/uploads/:path*"],
};