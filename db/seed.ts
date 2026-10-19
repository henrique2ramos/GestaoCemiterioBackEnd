import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { quadras, users } from "./schema";
import { hashSenha } from "../lib/password";

const NOMES_QUADRAS = ["A", "B", "C", "D", "E", "F"];

async function main() {
  for (const nome of NOMES_QUADRAS) {
    await db
      .insert(quadras)
      .values({ nome })
      .onConflictDoNothing();
  }
  console.log(`Quadras ensured: ${NOMES_QUADRAS.join(", ")}`);

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@falecido.com";
  const senhaDefinida = process.env.SEED_ADMIN_PASSWORD;
  const senha = senhaDefinida ?? "admin123";
  const passwordHash = hashSenha(senha);

  const [existente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existente) {
    // So reescreve a senha quando ela foi explicitamente informada no ambiente.
    if (senhaDefinida) {
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.email, email));
      console.log(`Admin atualizado: ${email}`);
    } else {
      console.log(`Admin ja existe (senha preservada): ${email}`);
    }
  } else {
    await db.insert(users).values({
      nome: "Administrador",
      email,
      passwordHash,
      role: "ADMIN",
    });

    console.log(`Admin criado: ${email}`);
  }

  if (!senhaDefinida) {
    console.warn(
      "ATENCAO: seed usou a senha padrao. Defina SEED_ADMIN_PASSWORD em producao.",
    );
  }
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });