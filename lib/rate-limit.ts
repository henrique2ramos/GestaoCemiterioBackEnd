type Registro = {
  tentativas: number;
  bloqueadoAte: number;
};

const MAX_TENTATIVAS = 5;
const JANELA_BLOQUEIO_MS = 15 * 60 * 1000;

const registros = new Map<string, Registro>();

function chaveDe(identificador: string): string {
  return identificador.trim().toLowerCase();
}

export function registrarFalha(identificador: string): void {
  const chave = chaveDe(identificador);
  const agora = Date.now();
  const registro = registros.get(chave);

  if (!registro || registro.bloqueadoAte <= agora) {
    registros.set(chave, { tentativas: 1, bloqueadoAte: 0 });
    return;
  }

  registro.tentativas += 1;

  if (registro.tentativas >= MAX_TENTATIVAS) {
    registro.bloqueadoAte = agora + JANELA_BLOQUEIO_MS;
  }
}

export function limparFalhas(identificador: string): void {
  registros.delete(chaveDe(identificador));
}

export function estaBloqueado(identificador: string): boolean {
  const registro = registros.get(chaveDe(identificador));

  if (!registro) {
    return false;
  }

  if (registro.bloqueadoAte <= Date.now()) {
    registros.delete(chaveDe(identificador));
    return false;
  }

  return true;
}
