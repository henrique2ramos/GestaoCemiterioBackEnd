-- Converte as colunas de id/FK de varchar(255) para o tipo uuid nativo do Postgres.
--
-- Ajuste manual sobre o SQL gerado pelo drizzle-kit, que omitia duas coisas:
--   1. o cast USING explicito (Postgres nao faz cast implicito de varchar para uuid)
--   2. o drop/recreate das foreign keys (Postgres recusa alterar o tipo de uma
--      coluna que participa de uma constraint)

-- 1. Derruba as FKs que envolvem as colunas a converter
ALTER TABLE "falecidos" DROP CONSTRAINT "falecidos_lote_id_lotes_id_fk";
--> statement-breakpoint
ALTER TABLE "lotes" DROP CONSTRAINT "lotes_quadra_id_quadras_id_fk";
--> statement-breakpoint

-- 2. Converte os tipos
ALTER TABLE "falecidos" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "falecidos" ALTER COLUMN "lote_id" SET DATA TYPE uuid USING "lote_id"::uuid;
--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "quadra_id" SET DATA TYPE uuid USING "quadra_id"::uuid;
--> statement-breakpoint
ALTER TABLE "quadras" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint

-- 3. Default de geracao pelo banco
ALTER TABLE "falecidos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "quadras" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint

-- 4. Recria as FKs
ALTER TABLE "falecidos" ADD CONSTRAINT "falecidos_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_quadra_id_quadras_id_fk" FOREIGN KEY ("quadra_id") REFERENCES "public"."quadras"("id") ON DELETE restrict ON UPDATE no action;