Fechado. B + cortar descricao = 21 campos.
Plano Final — Backend Memorial Digital
1. Schema definitivo
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  ATENDENTE
  VISITANTE
}

enum TipoFalecido {
  HISTORICA
  RECENTE
}

model User {
  id           String @id @default(cuid())
  nome         String @db.VarChar(255)
  email        String @unique @db.VarChar(255)
  passwordHash String @map("password_hash") @db.VarChar(255)
  role         Role   @default(ATENDENTE)

  @@map("users")
}

model Quadra {
  id      String   @id @default(cuid())
  nome    String   @unique @db.VarChar(20)
  tumbulos Tumulo[]

  @@map("quadras")
}

model Lote {
  id        String     @id @default(cuid())
  quadraId  String     @map("quadra_id")
  numero    String     @db.VarChar(20)      // "12", "12A", "3B" — texto, nunca int
  quadra    Quadra     @relation(fields: [quadraId], references: [id], onDelete: Restrict)
  falecidos Falecido[]

  @@unique([quadraId, numero])
  @@map("tumbulos")
}

model Falecido {
  id              String       @id @default(cuid())
  nome            String       @db.VarChar(255)
  dataNascimento DateTime?    @db.Date
  dataMorte       DateTime?    @db.Date
  tumuloId        String       @map("tumulo_id")
  tipo            TipoFalecido @default(RECENTE)
  biografia       String?
  mensagemFamilia String?      @map("mensagem_familia")
  imagemUrl       String?      @map("imagem_url") @db.VarChar(500)
  galeria         Json         @default("[]")
  createdAt       DateTime     @default(now()) @map("created_at")

  tumulo Tumulo @relation(fields: [tumuloId], references: [id], onDelete: Restrict)

  @@index([tumuloId])
  @@map("falecidos")
}
21 campos, 4 tabelas. Sem Setor, sem Cemiterio, sem Foto, sem ativo, sem updatedAt.
2. DTO — banco enxuto, API idêntica
// src/modules/falecidos/falecido.dto.ts
export function toMemorialDTO(f: Falecido & { tumulo: Tumulo & { quadra: Quadra } }) {
  return {
    id: f.id,
    nome: f.nome,
    biografia: f.biografia,
    descricao: f.biografia,              // ← compat: o front usa como fallback
    dataNascimento: fmtBR(f.dataNascimento),   // "dd/mm/aaaa"
    dataMorte: fmtBR(f.dataMorte),
    localizacao: `Quadra ${f.tumulo.quadra.nome}, Lote ${f.tumulo.numero}`,
    tipo: f.tipo === 'HISTORICA' ? 'historica' : 'recente',
    imagem: f.imagemUrl,
    galeria: f.galeria ?? [],            // ← o front recebe array, como sempre
    mensagemFamilia: f.mensagemFamilia,  // ← passa a renderizar
    createdAt: f.createdAt.toISOString(),
  };
}
Três garantias de compatibilidade:
- localizacao mantém o formato Quadra X, Lote Y → os 7 regex do admin seguem funcionando
- descricao espelha biografia → os cards não quebram mesmo sem o campo no banco
- tipo sai como historica/recente, nunca histórica
3. Os 6 endpoints (inalterados)
Método
GET
GET
POST
POST
PUT
DELETE
+ 2 rotas novas que hoje são só estado local no AdminMemoriais.jsx:
| GET/POST/PUT/DELETE | /api/quadras, /api/tumbulos | 🔒 |
Extras: GET /uploads/* (estático), GET / (health).
POST/PUT precisam aceitar multipart/form-data (com imagem e galeria[]) e application/json — o AdminMemoriais.jsx:191-202 alterna entre os dois.
Erros sempre { "erro": "..." } com Content-Type: application/json (api.js:47).
4. Estrutura de pastas
src/
├── server.ts              # bootstrap
├── app.ts                 # express + cors + helmet
├── config/env.ts          # valida process.env, sem fallback inseguro
├── lib/prisma.ts          # PrismaClient singleton
├── lib/errors.ts          # { erro } + handler 401/404/413
├── lib/upload.ts          # multer: uuid no nome, allowlist de extensão
├── modules/
│   ├── auth/ { auth.routes.ts, auth.service.ts, auth.dto.ts }
│   ├── falecidos/ { falecido.routes.ts, falecido.service.ts, falecido.dto.ts }
│   ├── quadras/ { quadra.routes.ts, quadra.service.ts }
│   └── tumbulos/ { tumulo.routes.ts, tumulo.service.ts }
└── middlewares/ { requireAuth.ts }
Separei quadras e tumbulos em módulos próprios porque o frontend já tem telas de CRUD para os dois — hoje isso morre no reload da página.
5. Fases
#	Entrega
1	package.json, pastas, schema.prisma, .env.example, Prisma client, GET /
2	prisma migrate dev + seed (6 quadras A–F, admin com bcrypt)
3	POST /api/login → { token }, requireAuth, rate limit
4	CRUD /api/memoriais (JSON + multipart), DTO, /uploads
5	/api/quadras + /api/tumbulos
6	Testes do contrato (as 6 rotas, os 3 formatos acoplados, 401)
7	Script de migração do SQLite antigo, se houver dado real
6. Tarefas que os cortes exigem
Corte	Obrigação
sem soft delete	deleteFalecido tem que apagar os arquivos de /uploads — senão reproduz o bug de memorial_service.py:54-56
sem tabela Foto	validação do JSON galeria no service
sem Setor	o mapa continua hardcoded em MapPage.jsx:11-18
sem ativo	DELETE é definitivo — confirmar que é o desejado
descricao cortada	AdminMemoriais.jsx:173 ainda manda o campo; o backend ignora. Limpar o formulário é fase do front
7. Duas premissas que estou assumindo
a) tumuloId é obrigatório. Todo falecido tem túmulo, senão a string localizacao fica vazia e o admin agrupa errado. Se existe o caso "óbito registrado antes da OCA", me avise que deixo nullable.