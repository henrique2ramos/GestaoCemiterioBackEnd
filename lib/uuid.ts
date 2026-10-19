import { ApiError } from "./errors";

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && REGEX_UUID.test(valor);
}

export function exigirUuid(valor: unknown, recurso: string): string {
  if (!ehUuid(valor)) {
    throw new ApiError(404, `${recurso} não encontrado.`);
  }

  return valor;
}
