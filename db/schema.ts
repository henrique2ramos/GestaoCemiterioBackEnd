import { relations } from "drizzle-orm";
import {
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("Role", ["ADMIN", "ATENDENTE", "VISITANTE"]);

export const tipoFalecidoEnum = pgEnum("TipoFalecido", ["HISTORICA", "RECENTE"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: varchar("nome", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: roleEnum("role").notNull().default("ATENDENTE"),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const quadras = pgTable(
  "quadras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: varchar("nome", { length: 20 }).notNull(),
  },
  (t) => [uniqueIndex("quadras_nome_key").on(t.nome)],
);

export const lotes = pgTable(
  "lotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quadraId: uuid("quadra_id")
      .notNull()
      .references(() => quadras.id, { onDelete: "restrict" }),
    numero: varchar("numero", { length: 20 }).notNull(),
  },
  (t) => [uniqueIndex("lotes_quadra_id_numero_key").on(t.quadraId, t.numero)],
);

export const falecidos = pgTable(
  "falecidos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: varchar("nome", { length: 255 }).notNull(),
    // Mode string de proposito: o drizzle converte DATE em Date (new Date(string)),
    // que e meia-noite UTC e vira o dia anterior em fusos negativos. A string
    // "YYYY-MM-DD" do Postgres nao tem fuso e e formatada direto.
    dataNascimento: date("dataNascimento"),
    dataMorte: date("dataMorte"),
    loteId: uuid("lote_id")
      .notNull()
      .references(() => lotes.id, { onDelete: "restrict" }),
    tipo: tipoFalecidoEnum("tipo").notNull().default("RECENTE"),
    biografia: text("biografia"),
    mensagemFamilia: text("mensagem_familia"),
    imagemUrl: varchar("imagem_url", { length: 500 }),
    galeria: jsonb("galeria").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("falecidos_lote_id_idx").on(t.loteId)],
);

export const usersRelations = relations(users, () => ({}));

export const quadrasRelations = relations(quadras, ({ many }) => ({
  lotes: many(lotes),
}));

export const lotesRelations = relations(lotes, ({ one, many }) => ({
  quadra: one(quadras, {
    fields: [lotes.quadraId],
    references: [quadras.id],
  }),
  falecidos: many(falecidos),
}));

export const falecidosRelations = relations(falecidos, ({ one }) => ({
  lote: one(lotes, {
    fields: [falecidos.loteId],
    references: [lotes.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Quadra = typeof quadras.$inferSelect;
export type NewQuadra = typeof quadras.$inferInsert;
export type Lote = typeof lotes.$inferSelect;
export type NewLote = typeof lotes.$inferInsert;
export type Falecido = typeof falecidos.$inferSelect;
export type NewFalecido = typeof falecidos.$inferInsert;