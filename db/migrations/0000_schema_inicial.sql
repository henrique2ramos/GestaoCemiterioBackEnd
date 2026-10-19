CREATE TYPE "public"."Role" AS ENUM('ADMIN', 'ATENDENTE', 'VISITANTE');--> statement-breakpoint
CREATE TYPE "public"."TipoFalecido" AS ENUM('HISTORICA', 'RECENTE');--> statement-breakpoint
CREATE TABLE "falecidos" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"dataNascimento" date,
	"dataMorte" date,
	"lote_id" varchar(255) NOT NULL,
	"tipo" "TipoFalecido" DEFAULT 'RECENTE' NOT NULL,
	"biografia" text,
	"mensagem_familia" text,
	"imagem_url" varchar(500),
	"galeria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lotes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"quadra_id" varchar(255) NOT NULL,
	"numero" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quadras" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"nome" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "Role" DEFAULT 'ATENDENTE' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "falecidos" ADD CONSTRAINT "falecidos_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_quadra_id_quadras_id_fk" FOREIGN KEY ("quadra_id") REFERENCES "public"."quadras"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "falecidos_lote_id_idx" ON "falecidos" USING btree ("lote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lotes_quadra_id_numero_key" ON "lotes" USING btree ("quadra_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "quadras_nome_key" ON "quadras" USING btree ("nome");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");