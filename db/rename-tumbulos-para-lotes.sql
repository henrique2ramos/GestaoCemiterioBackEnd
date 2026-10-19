-- Renomeia a entidade Tumbulo -> Lote.
--
-- Contexto: o contrato da API ja fala "Lote" (localizacao no formato
-- "Quadra X, Lote Y"), entao o nome da tabela acompanha.
--
-- Executar no SQL Editor do Supabase. Nao apaga dados: apenas renomeia
-- tabela, coluna, indices e constraints.
--
-- ATENCAO: nao e idempotente. Rodar duas vezes vai falhar no primeiro ALTER.

BEGIN;

-- Tabela
ALTER TABLE "tumbulos" RENAME TO "lotes";

-- Coluna da FK
ALTER TABLE "falecidos" RENAME COLUMN "tumulo_id" TO "lote_id";

-- Indices
ALTER INDEX "falecidos_tumulo_id_idx" RENAME TO "falecidos_lote_id_idx";
ALTER INDEX "tumbulos_quadra_id_numero_key" RENAME TO "lotes_quadra_id_numero_key";

-- Constraints: o Postgres nao renomeia sozinho ao renomear a tabela referenciada
ALTER TABLE "falecidos"
  RENAME CONSTRAINT "falecidos_tumulo_id_tumbulos_id_fk"
  TO "falecidos_lote_id_lotes_id_fk";

ALTER TABLE "lotes"
  RENAME CONSTRAINT "tumbulos_quadra_id_quadras_id_fk"
  TO "lotes_quadra_id_quadras_id_fk";

-- A PK tambem mantem o nome antigo (o index segue o constraint)
ALTER TABLE "lotes"
  RENAME CONSTRAINT "tumbulos_pkey"
  TO "lotes_pkey";

COMMIT;


-- ---------------------------------------------------------------------------
-- Verificacao: esperar "lotes" no lugar de "tumbulos".
-- ---------------------------------------------------------------------------

SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
 ORDER BY table_name;

SELECT indexname
  FROM pg_indexes
 WHERE schemaname = 'public'
 ORDER BY indexname;

SELECT conname
  FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace
 ORDER BY conname;

-- Colunas de falecidos: esperar lote_id no lugar de tumulo_id
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'falecidos'
 ORDER BY ordinal_position;