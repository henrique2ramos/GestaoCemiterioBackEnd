import { randomUUID } from "node:crypto";
import { ApiError } from "./errors";

const EXTENSOES = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const TAMANHO_MAX = 5 * 1024 * 1024;
const BUCKET = "falecidos";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL nao configurada no .env");
}

if (!SUPABASE_SECRET_KEY) {
  throw new Error("SUPABASE_SECRET_KEY nao configurada no .env");
}

const PREFIXO_PUBLICO = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const PADRAO_ARQUIVO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$/i;

function extensao(nomeArquivo: string): string {
  const partes = nomeArquivo.toLowerCase().split(".");
  return partes.length > 1 ? (partes.at(-1) ?? "") : "";
}

function ehArquivo(valor: unknown): valor is File {
  return (
    typeof File !== "undefined" &&
    valor instanceof File &&
    typeof valor.name === "string" &&
    valor.size >= 0
  );
}

export function objetoDoBucket(url: string): string | null {
  if (!url.startsWith(PREFIXO_PUBLICO)) {
    return null;
  }

  const cauda = url.slice(PREFIXO_PUBLICO.length).split("?")[0];

  if (!PADRAO_ARQUIVO.test(cauda)) {
    return null;
  }

  return cauda;
}

function headers(): Record<string, string> {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  };
}

export async function salvarUpload(arquivo: File): Promise<string> {
  const ext = extensao(arquivo.name);

  if (!EXTENSOES.has(ext)) {
    throw new ApiError(
      400,
      `Formato de imagem nao suportado${ext ? ` (.${ext})` : ""}. Use JPG, PNG, WEBP ou GIF.`,
    );
  }

  if (arquivo.size > TAMANHO_MAX) {
    throw new ApiError(400, "A imagem excede o limite de 5 MB.");
  }

  const nome = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${nome}`, {
    method: "POST",
    headers: {
      ...headers(),
      "Content-Type": arquivo.type || `image/${ext}`,
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw new ApiError(
      502,
      `Falha ao enviar imagem para o armazenamento: ${texto || res.statusText}`,
    );
  }

  return `${PREFIXO_PUBLICO}${nome}`;
}

export async function salvarUploads(arquivos: File[]): Promise<string[]> {
  const urls: string[] = [];

  for (const arquivo of arquivos) {
    urls.push(await salvarUpload(arquivo));
  }

  return urls;
}

export async function removerUpload(url: string | null | undefined): Promise<void> {
  if (!url) {
    return;
  }

  const nome = objetoDoBucket(url);

  // URL externa ou placeholder: nao eh do nosso bucket, nada a remover
  if (!nome) {
    return;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${nome}`,
      {
        method: "DELETE",
        headers: headers(),
      }
    );

    // 404 = ja nao existe; demais falhas sao apenas avisos no log
    if (!res.ok && res.status !== 404) {
      const texto = await res.text().catch(() => "");
      console.error(
        `Falha ao remover do Supabase ${nome}: ${res.status} ${texto}`,
      );
    }
  } catch (e) {
    console.error(`Erro de rede ao remover ${nome}:`, e);
  }
}

export async function extrairArquivosDeFormulario(
  form: FormData,
  campo: string,
): Promise<File[]> {
  return form
    .getAll(campo)
    .filter(ehArquivo)
    .filter((arquivo) => arquivo.size > 0 && arquivo.name !== "");
}