# 📦 ChefStock

ChefStock é um sistema web/PWA B2B para gestão de estoque e compras de restaurantes. Ele ajuda a resolver o problema de desperdício e compras mal dimensionadas, cruzando o limite mínimo de insumos estipulado pelo dono com a contagem diária feita pelos funcionários na despensa.

## 🛠️ Stack Tecnológica

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS v4
- **Banco de Dados & Autenticação:** Supabase

## 🚀 Como Executar

Primeiro, certifique-se de configurar as variáveis de ambiente do Supabase (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`) no arquivo `.env.local`.

Instale as dependências:

```bash
npm install
```

Em seguida, execute o servidor de desenvolvimento:

```bash
npm run dev
```

Sua aplicação estará disponível em [http://localhost:3000](http://localhost:3000).

### Rotas Principais
- `/admin`: Dashboard responsivo para o dono/gestor gerenciar insumos e visualizar listas de compras.
- `/contador`: Interface mobile-first para o funcionário realizar a contagem diária da despensa.
- `/login`: Tela de autenticação.

## 🗄️ Estrutura de Banco de Dados (Supabase)

Atualmente utilizamos duas tabelas principais:
1. **`ingredients`**: Insumos (`id`, `name`, `unit`, `min_stock`, `active`).
2. **`daily_counts`**: Histórico de contagens (`id`, `ingredient_id`, `actual_amount`, `counted_at`).

## 🏗️ Arquitetura

O projeto adota uma Clean Architecture simplificada com Next.js App Router:
- `src/app/`: Rotas, páginas e layouts.
- `src/components/`: Componentes visuais reutilizáveis.
- `src/lib/`: Configurações de serviços externos (ex: clientes do Supabase).
- `src/types/`: Tipagens globais TypeScript.

## 🔜 Próximos Passos (Roadmap)
- Concluir implementação de autenticação (Supabase Auth).
- Finalizar integração PWA (Manifest e Service Worker).
- Refinar UX (Skeletons de Loading e Toasts).
- Configuração de políticas RLS (Row Level Security) no Supabase.

