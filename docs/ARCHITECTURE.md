# BookedUp Network OS — Arquitetura do MVP (v4.0)

Documento de entrada exigido pela seção 40 do prompt mestre: arquitetura, páginas, dados, permissões, fluxos e plano. Interface em inglês americano; este documento em português.

---

## 1. Resumo da arquitetura

| Camada | Escolha | Por quê |
|---|---|---|
| App | Next.js 15 (App Router) + React + TypeScript | Um único deploy para site público, app das empresas e admin |
| UI | Tailwind CSS + shadcn/ui + Lucide | Componentes acessíveis, tokens globais roxo/branco/preto |
| Backend | Server Actions + Route Handlers (só onde precisa de URL pública) | Monólito modular, sem API separada |
| Banco | Supabase PostgreSQL com Row Level Security em toda tabela privada | Isolamento por organização garantido no banco, não só no código |
| Auth | Supabase Auth (e-mail + senha, verificação de e-mail, reset, MFA para admins) | Pronto, auditado, sem servidor próprio |
| Arquivos | Supabase Storage, buckets privados com URL assinada | Logos públicos; licenças e seguros privados |
| Jobs | pg_cron no próprio Postgres | Recalcular scores e status de ativação toda noite; sem filas nem Redis |
| E-mail transacional | Supabase Auth para login; Resend opcional depois (seção 31: "quando configurado") | Nenhum fluxo depende de integração que ainda não existe |
| Hospedagem | Vercel | Deploy do Next.js sem infraestrutura |

**Módulos do monólito** (`src/modules/*`): `auth`, `organizations`, `directory`, `referrals`, `consent`, `matching`, `opportunities`, `scoring`, `growth`, `admin`, `notifications`, `audit`, `billing` (só esquema, sem tela).

**Regras de segurança da arquitetura**
- Toda leitura e escrita passa por RLS. O `service_role` só é usado em 3 lugares do servidor: formulário público `/r/[code]`, jobs de cálculo e ações administrativas. Cada uso é registrado em `audit_logs`.
- Nenhuma ação confia em `organization_id` vindo do navegador: o servidor resolve a organização pela sessão e checa a associação em `organization_members`.
- Dados do proprietário ficam em tabela separada (`homeowner_contacts`), que nenhuma empresa lê diretamente. O prestador só vê o contato por uma função `SECURITY DEFINER` que exige atribuição aceita + consentimento válido.
- Multi-rede preparada: toda organização, categoria e região pertence a um `network_id`. O MVP tem uma rede, **BookedUp Orlando**, e nenhuma tela para gerenciar redes.

---

## 2. Mapa das páginas

**Público**
`/` · `/how-it-works` · `/partners` (para quem indica) · `/providers` (para quem recebe) · `/services` (serviços por região) · `/directory` (diretório público) · `/directory/[slug]` (perfil público) · `/r/[code]` (formulário do proprietário) · `/signup` (3 etapas) · `/login` · `/forgot-password` · `/reset-password` · `/privacy` · `/terms`

**App da empresa** (`/app`, menu muda conforme Can Refer / Can Receive)
| Rota | Tela | Quem vê |
|---|---|---|
| `/app` | Dashboard: 4 cards, "+ Send Referral", atividade recente, checklist de onboarding | Todos aprovados ou pendentes (acesso limitado) |
| `/app/referrals/new` | Send a Referral / Share Referral Link | Can Refer |
| `/app/referrals` | My Referrals com status | Can Refer |
| `/app/opportunities` | Opportunities: New, Accepted, In Progress, Completed, Declined | Can Receive |
| `/app/opportunities/[id]` | Aceitar, recusar, pipeline e notas | Can Receive |
| `/app/partners` | Find Partners (diretório privado da rede) + "Refer a Project" | Aprovados |
| `/app/ranking` | My Ranking: score, nível, posição regional | Aprovados |
| `/app/business` | Perfil, serviços, áreas, equipe, documentos | Owner e Manager editam |
| `/app/support` | Contato com a BookedUp | Todos |

**Admin** (`/admin`): Overview + Action Required · Organizations · Pending Approvals · Referrals (fila de qualificação) · Matching · Service Directory (categorias) · Regional Coverage · Partner Rankings · Provider Rankings · Relationships · Partners to Follow Up · Growth Clients · Reports · Settings (pesos dos scores, textos de consentimento, períodos).

---

## 3. Modelo de dados

UUID em todas as chaves, `created_at`/`updated_at` em todas as tabelas, `deleted_at` onde há exclusão lógica. Contagens são derivadas de eventos, nunca guardadas à mão.

**Rede e catálogo**
- `networks` (id, name, slug, status) — uma linha no MVP.
- `service_categories` (id, network_id, name, slug, active, sort) — administrável.
- `regions` (id, network_id, state, city, zip_codes[]) — 8 cidades iniciais.

**Pessoas e empresas**
- `profiles` (id = auth.users.id, full_name, phone, platform_role: `super_admin | admin | null`, mfa_required).
- `organizations` (id, network_id, name, slug, category_id, email, phone, website, logo_path, description, state, city, zip, status: `pending_review | approved | suspended | rejected`, verification: `not_verified | pending | verified | expired`, referral_code unique, out_of_scope_last_30d: `0 | 1-2 | 3-5 | 6+`, deleted_at).
- `organization_members` (org_id, user_id, role: `owner | manager | member`, unique(org_id, user_id)).
- `organization_capabilities` (org_id, capability: `refer | receive`, requested_at, status: `requested | approved | revoked`, approved_by, approved_at). Aprovação de indicar e de receber é separada.
- `organization_services` (org_id, category_id, kind: `offered | not_offered`).
- `organization_service_areas` (org_id, region_id, zip).
- `organization_documents` (org_id, type: `license | insurance | other`, path em bucket privado, expires_on, status).
- `organization_followups` (org_id, relationship_owner, last_contact_at, next_followup_at, notes, outcome) — follow-up de ativação, sem CRM completo.
- `organization_connections` (org_a, org_b, requested_by, status: `requested | accepted | declined | blocked`, unique par ordenado).

**Indicações e consentimento**
- `referrals` (id, network_id, source_org_id, source_user_id, channel: `direct | link | partner_direct`, suggested_provider_org_id, category_id, city, zip, description, timeline, status: `submitted | consent_pending | under_review | qualified | matching | assigned | closed | rejected`, qualification checklist c1–c7, qualification_status, qualified_by, qualified_at, qualification_notes, duplicate_of, created_at). `source_org_id` é gravado pelo servidor e nunca editável.
- `homeowner_contacts` (referral_id unique, name, phone, email, address opcional) — sem policy de leitura para empresas.
- `consent_records` (referral_id, status: `pending | granted | revoked`, source: `homeowner_form | partner_attested | admin_verified`, text_version_id, granted_at, revoked_at, ip_hash, user_agent).
- `consent_text_versions` (id, version, body, purpose, active_from) — o texto exato que a pessoa viu.

**Distribuição e pipeline**
- `referral_assignments` (id, referral_id, provider_org_id, suggested_by, assigned_by, assigned_at, status: `offered | accepted | declined | contacted | estimate_scheduled | estimate_sent | won | lost`, estimated_value, first_contact_at, unique(referral_id, provider_org_id)).
- `opportunity_status_events` (assignment_id, from_status, to_status, actor_user_id, note, at) — histórico imutável; timestamps automáticos.

**Desempenho**
- `partner_score_snapshots` (org_id, period_end, submitted, qualified, qualification_rate, last_30, last_90, active_months, duplicate_rate, score, level).
- `provider_score_snapshots` (org_id, period_end, received, acceptance_rate, avg_response_minutes, pipeline_updates, verified_feedback, reliability, score, level).
- `score_settings` (network_id, kind, weights jsonb, min_volume) — pesos configuráveis.
- View `organization_activation_status`: `registered → approved → activated → productive → inactive`, calculada por regra (aprovada + serviços + áreas + link = activated; 1+ indicação qualificada em 30 dias = productive).

**Growth (produto separado da assinatura)**
- `growth_contracts` (id, provider_org_id, start_date, deadline = start + 90, target default 24, status: `active | completed | continuation_required | cancelled`, offer_text_version).
- `growth_deliveries` (contract_id, assignment_id unique, referral_id, delivered_at, counted bool, audit_note, unique(contract_id, referral_id)). Uma indicação nunca conta duas vezes para o mesmo contrato, e uma atribuição nunca conta para dois contratos.

**Sistema**
- `notifications` (user_id ou org_id, type, payload, read_at).
- `audit_logs` (actor, action, entity, entity_id, org_id, metadata sem PII, at) — preenchido por triggers nas tabelas críticas.
- `rate_limits` (key_hash, window_start, count) — limitador do formulário público em Postgres.
- Futuro, só esquema: `plans`, `subscriptions`, `entitlements`, `usage_limits`, `billing_events` (todos por `org_id`).

---

## 4. Matriz de permissões

✓ = pode · ◐ = só da própria organização · — = não

| Ação | Super Admin | Admin | Org Owner | Org Manager | Org Member |
|---|---|---|---|---|---|
| Aprovar/rejeitar/suspender empresa | ✓ | ✓ | — | — | — |
| Aprovar capacidade indicar/receber | ✓ | ✓ | — | — | — |
| Editar categorias, regiões, pesos, textos de consentimento | ✓ | ✓ | — | — | — |
| Gerenciar admins e configurações da rede | ✓ | — | — | — | — |
| Editar perfil, serviços e áreas da empresa | ✓ | ✓ | ◐ | ◐ | — |
| Convidar/remover membros | ✓ | ✓ | ◐ | ◐ (só members) | — |
| Enviar indicação (exige Can Refer aprovado) | — | ✓ (manual) | ◐ | ◐ | ◐ |
| Ver status das próprias indicações | ✓ | ✓ | ◐ | ◐ | ◐ |
| Ver dados do proprietário de uma indicação | ✓ | ✓ | ◐ só o que a própria empresa enviou | ◐ idem | ◐ idem |
| Qualificar, detectar duplicidade, fazer matching, atribuir | ✓ | ✓ | — | — | — |
| Aceitar/recusar oportunidade (exige Can Receive aprovado) | — | — | ◐ | ◐ | ◐ |
| Ver contato do proprietário de oportunidade aceita | ✓ | ✓ | ◐ | ◐ | ◐ |
| Atualizar pipeline e valor estimado | — | — | ◐ | ◐ | ◐ |
| Ver ranking completo e leaderboard | ✓ | ✓ | só a própria posição | idem | idem |
| Ver documentos de licença/seguro | ✓ | ✓ | ◐ | ◐ | — |
| Contratos e entregas Growth | ✓ | ✓ | ◐ leitura do próprio contrato | ◐ leitura | — |
| Ler audit logs | ✓ | ✓ (sem exclusão) | — | — | — |

Regras transversais: empresa `suspended` perde envio e recebimento na hora; capacidade não aprovada esconde o menu e é bloqueada também no banco; quem enviou a indicação nunca vê dados do prestador além do nome comercial e do status.

---

## 5. Fluxos de indicação

**A. Envio direto (âncora preenche)**
1. `/app/referrals/new` → serviço, cidade, ZIP, descrição, prazo, dados do proprietário.
2. Checkbox "o proprietário autorizou o compartilhamento" (desmarcado por padrão) → `consent_records.source = partner_attested`, status `pending`.
3. Indicação entra como `consent_pending`. Os dados ficam restritos até a BookedUp confirmar com o proprietário (ligação ou e-mail) → `admin_verified` → `under_review`.

**B. Link da âncora (`/r/[code]`, preferido)**
1. O proprietário abre o link, preenche os próprios dados e marca o consentimento com texto versionado.
2. O servidor grava origem pelo `code` (o usuário não altera), registra IP em hash, aplica limite de envios e honeypot.
3. Indicação já nasce `under_review`, com `consent.source = homeowner_form`.

**C. Indicar para um parceiro específico**
1. `/app/partners` → busca → perfil → "Refer a Project" → mesmo formulário do fluxo A.
2. O destinatário fica em `suggested_provider_org_id`. Nada é entregue automaticamente: passa pela mesma fila do admin.

**D. Qualificação, matching e atribuição (admin)**
1. Fila "Under Review": checklist dos 7 critérios + alerta de possível duplicidade (mesmo telefone ou e-mail, mesmo serviço, janela de 30 dias).
2. `qualified` → `matching`: lista de prestadores sugeridos por regra (serviço, região, capacidade aprovada, verificação aplicável, score), com o sugerido pela âncora no topo se existir.
3. Admin atribui → `assigned`; prestador recebe notificação **sem** dados pessoais.
4. Prestador aceita → vê o contato pela função segura; recusa → volta para `matching` sem penalidade se o motivo for "incompatível".
5. Pipeline: contacted → estimate scheduled → estimate sent → won/lost, com eventos e timestamps.
6. A âncora acompanha: Submitted, Under Review, Qualified, Assigned, Closed.

**E. Contagem Growth**
1. Ao atribuir para um cliente Growth com contrato ativo, cria-se `growth_deliveries` ligada à atribuição.
2. Conta para as 24 só se: indicação `qualified`, consentimento `granted`, atribuição aceita ou entregue dentro do prazo do contrato, sem duplicidade. Pedido de orçamento, visita e obra fechada são eventos diferentes e só o primeiro conta.

---

## 6. Plano de desenvolvimento

| Fase | Entrega | Pronto quando |
|---|---|---|
| **1 · Foundation** | Projeto Next.js, design system (tokens, botões, inputs, tabelas, cards, sidebar), layout responsivo, Supabase com migrações de `networks`, `profiles`, `organizations`, `organization_members`, `organization_capabilities`, funções de autorização, RLS, login, cadastro, reset, verificação de e-mail, audit trigger | Testes de acesso cruzado passam; login e logout no celular e no desktop |
| **2 · Network** | Cadastro em 3 etapas, aprovação, perfil, serviços, áreas, diretório público e privado, `/services` | Admin aprova empresa e ela aparece no diretório |
| **3 · Referrals** | Envio direto, link, consentimento versionado, histórico, fila de qualificação, duplicidade | Proprietário envia pelo link e admin qualifica |
| **4 · Distribution** | Matching por regra, atribuição, aceite/recusa, pipeline | Prestador aceita e vê o contato; âncora vê o status |
| **5 · Management** | Overview com Action Required, status de ativação, follow-up, scores noturnos, Regional Coverage, Relationships | KPI "qualificadas por âncora produtiva por mês" em 30 e 90 dias |
| **6 · Business Ops** | Growth Clients, entregas auditáveis, relatórios | Contagem das 24 sem duplicidade, auditável por entrega |
| 7 · Future SaaS | Só o esquema de planos e assinaturas | Não implementar agora |

**Testes:** testes de integração das policies RLS contra um Postgres local (acesso cruzado, papéis, capacidades), testes unitários das regras de score e contagem Growth, e Playwright nos fluxos principais em largura de celular e desktop. Nenhuma fase é dada como concluída sem backend, banco e teste do fluxo.

---

## Pontos para decidir ou validar

1. **Texto da oferta Growth (seção 25)** inclui "Or We Keep Working at No Additional Service Fee Until We Deliver". No plano mestre essa garantia está como "Não aprovada". O sistema guarda o texto como versão configurável e o status `continuation_required`, mas a frase só deve aparecer em contrato ou página depois de aprovada.
2. **Consentimento atestado pela âncora** (fluxo A) não é consentimento do proprietário. Proposta: dado restrito até a BookedUp confirmar. O link do proprietário (fluxo B) deve ser o caminho padrão.
3. **Revisão jurídica antes do piloto:** termos, política de privacidade, texto de consentimento, retenção e exclusão de dados, e qualquer contato com proprietários por telefone ou SMS.
4. **Rankings visíveis entre empresas** ficam desligados até decisão de visibilidade (seção 19).
