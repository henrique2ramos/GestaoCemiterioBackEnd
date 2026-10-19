export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function toErroResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ erro: error.message }, { status: error.status });
  }

  // 22P02 = invalid_text_representation: id em formato invalido para o
  // tipo uuid do Postgres. Sem isto, um id malformado viraria 500.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "22P02"
  ) {
    return Response.json({ erro: "Identificador inválido." }, { status: 400 });
  }

  console.error("Erro inesperado na API:", error);

  return Response.json(
    { erro: "Erro interno do servidor." },
    { status: 500 },
  );
}