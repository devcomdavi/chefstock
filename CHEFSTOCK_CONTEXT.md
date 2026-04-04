# Contexto do Projeto: ChefStock

## 🎯 Objetivo
O ChefStock é um sistema web/PWA B2B para gestão de estoque e compras de restaurantes. Ele resolve o problema de desperdício e compras mal dimensionadas, cruzando o limite mínimo de insumos estipulado pelo dono com a contagem diária feita pelos funcionários na despensa.

## 🛠️ Stack Tecnológica
- **Framework:** Next.js (App Router)
- **Linguagem:** TypeScript (Tipagem estrita obrigatória)
- **Estilização:** Tailwind CSS
- **Banco de Dados & Auth:** Supabase (PostgreSQL)
- **Gerenciamento de Estado/Fetch:** React Hooks nativos (futuramente TanStack Query, se necessário)

## 🏗️ Arquitetura de Pastas (Clean Architecture Simplificada)
- `src/app/`: Rotas do Next.js (Páginas e Layouts).
  - `/contador`: Visão do funcionário (Mobile-first).
  - `/admin`: Visão do dono/gestor (Dashboard responsivo).
- `src/components/`: Componentes visuais reutilizáveis (UI burra).
- `src/lib/`: Configurações de infraestrutura (ex: `supabase.ts`).
- `src/types/`: Contratos e interfaces globais do TypeScript (`index.ts`).

## 🗄️ Esquema de Banco de Dados (Supabase)
Temos 2 tabelas principais atualmente:
1. **`ingredients`**: `id` (uuid), `name` (text), `unit` (text), `min_stock` (numeric), `active` (boolean).
2. **`daily_counts`**: `id` (uuid), `ingredient_id` (uuid/FK), `actual_amount` (numeric), `counted_at` (timestamp tz).

## 🚀 Status Atual das Funcionalidades
- **Frontend /contador:** Lê insumos do banco e faz `INSERT` em massa (Array de objetos) na tabela `daily_counts`.
- **Frontend /admin:** Lê insumos e as contagens das últimas 24h. Calcula a lista de compras no frontend (`amountToBuy = min_stock - actual_amount`). Permite edição inline (*inline edit*) do `min_stock` fazendo `UPDATE` direto na tabela e possui formulário para `INSERT` de novos insumos.
- **Segurança (RLS):** Atualmente o Row Level Security está desabilitado/permissivo para desenvolvimento. Próximo passo é ativar e atrelar ao Supabase Auth.

## ⚠️ Regras e Diretrizes para o Agente de IA
1. **NÃO QUEBRE O NEXT.JS APP ROUTER:** Todas as páginas devem exportar um `default function` válido e usar `'use client'` apenas quando necessário (estado, efeitos ou interatividade).
2. **MANTENHA A TIPAGEM:** Não use `any`. Sempre importe e use as interfaces de `src/types/index.ts`.
3. **MANTENHA A UX/UI:** - A tela `/contador` deve ser sempre Mobile-First (botões grandes, inputs fáceis de tocar).
   - A tela `/admin` deve focar em densidade de dados (tabelas claras, badges de status, edição em linha).
4. **SUPABASE:** Use o cliente instanciado em `@/lib/supabase`. Faça mapeamento de dados `snake_case` (banco) para `camelCase` (frontend) onde necessário.

## 🔜 Próximos Passos Prioritários
- Implementar Autenticação (Supabase Auth).
- Configurar PWA (Manifest e Service Worker).
- Refinar UX com Toasts e Skeletons de Loading.