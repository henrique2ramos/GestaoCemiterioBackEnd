import { ApiError } from "./errors";

export function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizarQuadra(value: unknown): string {
  const nome = texto(value).toUpperCase();

  if (!nome) {
    throw new ApiError(400, "O nome da quadra é obrigatório.");
  }

  if (nome.length > 20) {
    throw new ApiError(400, "O nome da quadra deve ter no máximo 20 caracteres.");
  }

  return nome;
}

export function normalizarLote(value: unknown): string {
  const numero = texto(value);

  if (!numero) {
    throw new ApiError(400, "O número do lote é obrigatório.");
  }

  if (numero.length > 20) {
    throw new ApiError(400, "O número do lote deve ter no máximo 20 caracteres.");
  }

  return numero;
}
