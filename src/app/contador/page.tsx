// src/app/contador/page.tsx
'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import Skeleton from '@/components/Skeleton';
import { Ingredient, IngredientCategory, UserRole } from '@/types';

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  cozinha: '👨‍🍳 Cozinha',
  salao: '🍽️ Salão',
};

export default function ContadorPage() {
  const supabase = createClient();

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState('');
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>('cozinha');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCountId, setEditingCountId] = useState<string | null>(null);

  // Busca o perfil do usuário logado e trava a aba
  useEffect(() => {
    async function getUserProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('id', user.id)
        .single();

      if (profile) {
        const role = profile.role as UserRole;
        setUserRole(role);
        setUserName(profile.name);

        // Trava na categoria do perfil
        if (role === 'contador_cozinha') setActiveCategory('cozinha');
        if (role === 'contador_salao') setActiveCategory('salao');
      }
    }
    getUserProfile();
  }, [supabase]);

  // Busca insumos
  useEffect(() => {
    async function fetchIngredients() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar insumos:', error);
        toast.error('Erro ao carregar os dados do banco.');
      } else if (data) {
        const formattedData: Ingredient[] = data.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          minStock: item.min_stock,
          category: item.category as IngredientCategory,
        }));
        setIngredients(formattedData);
      }
      setIsLoading(false);
    }
    fetchIngredients();
  }, [supabase]);

  // O usuário pode trocar de aba?
  const isLocked = userRole === 'contador_cozinha' || userRole === 'contador_salao';

  const filteredIngredients = ingredients.filter(
    (item) => item.category === activeCategory
  );

  const handleUpdateCount = (id: string, amount: number) => {
    setCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + amount),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const activeCategoryIds = new Set(filteredIngredients.map((i) => i.id));
      // Busca o user logado para associar ao registro
      const { data: { user } } = await supabase.auth.getUser();

      const inserts = Object.entries(counts)
        .filter(([ingredientId]) => activeCategoryIds.has(ingredientId))
        .map(([ingredientId, amount]) => ({
          ingredient_id: ingredientId,
          actual_amount: amount,
          user_id: user?.id || null,
        }));

      if (inserts.length === 0) {
        toast.error('Você não alterou nenhuma quantidade ainda.');
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('daily_counts').insert(inserts);
      if (error) throw error;

      toast.success('Contagem salva com sucesso! 🚀');
      setCounts((prev) => {
        const next = { ...prev };
        for (const id of activeCategoryIds) {
          delete next[id];
        }
        return next;
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar a contagem. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contagem Diária</h1>
          <p className="text-sm text-gray-500">
            {userName ? `Olá, ${userName}!` : 'Registre o estoque atual.'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Sair
        </button>
      </header>

      {/* Tabs de Categoria */}
      <div className="px-4 pt-2 pb-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          {(Object.keys(CATEGORY_LABELS) as IngredientCategory[]).map((cat) => {
            const isDisabled = isLocked && activeCategory !== cat;
            return (
              <button
                key={cat}
                onClick={() => { if (!isDisabled) setActiveCategory(cat); }}
                disabled={isDisabled}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                  activeCategory === cat
                    ? cat === 'cozinha'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-blue-500 text-white shadow-md'
                    : isDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {CATEGORY_LABELS[cat]}
                {isDisabled && ' 🔒'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Insumos */}
      <div className="flex-1 px-4 pb-24 space-y-3">
        {isLoading ? (
          <div className="space-y-3 pt-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : filteredIngredients.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{activeCategory === 'cozinha' ? '👨‍🍳' : '🍽️'}</p>
            <p className="text-gray-500 font-medium">Nenhum insumo cadastrado para {CATEGORY_LABELS[activeCategory]}.</p>
            <p className="text-gray-400 text-sm mt-1">Peça ao gestor para adicionar insumos nesta categoria.</p>
          </div>
        ) : (
          filteredIngredients.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">{item.name}</h2>
                <span className="text-xs text-gray-400">Unidade: {item.unit}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleUpdateCount(item.id, -1)}
                  className="w-11 h-11 rounded-full bg-red-100 text-red-600 font-bold text-xl flex items-center justify-center active:bg-red-200 transition-colors">-</button>
                {editingCountId === item.id ? (
                  <input
                    type="number"
                    min="0"
                    autoFocus
                    value={counts[item.id] || 0}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setCounts((prev) => ({ ...prev, [item.id]: val }));
                    }}
                    onBlur={() => setEditingCountId(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingCountId(null); }}
                    className="w-16 text-center font-bold text-lg border-2 border-blue-500 rounded-lg p-1 outline-none text-black"
                  />
                ) : (
                  <span
                    onClick={() => setEditingCountId(item.id)}
                    className="w-12 text-center font-bold text-lg cursor-pointer hover:bg-gray-100 rounded-lg p-1 transition-colors border border-dashed border-transparent hover:border-gray-300 text-black"
                  >
                    {counts[item.id] || 0}
                  </span>
                )}
                <button onClick={() => handleUpdateCount(item.id, 1)}
                  className="w-11 h-11 rounded-full bg-green-100 text-green-600 font-bold text-xl flex items-center justify-center active:bg-green-200 transition-colors">+</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Botão fixo de salvar */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full font-bold py-4 rounded-xl shadow-md transition-colors ${
            isSaving ? 'bg-blue-400 cursor-not-allowed'
              : activeCategory === 'cozinha' ? 'bg-orange-500 hover:bg-orange-600'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
        >
          {isSaving ? 'Salvando...' : `Salvar Contagem — ${CATEGORY_LABELS[activeCategory]}`}
        </button>
      </div>
    </main>
  );
}