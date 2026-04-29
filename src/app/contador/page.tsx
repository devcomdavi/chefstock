'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import Skeleton from '@/components/Skeleton';
import { Ingredient, UserRole, Category } from '@/types';

export default function ContadorPage() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCountId, setEditingCountId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      // Fetch categories
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      const loadedCats = cats || [];
      setCategories(loadedCats);

      // Fetch user profile
      const { data: { user } } = await supabase.auth.getUser();
      let role: string[] = [];
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single();
        if (profile) {
          role = profile.role || [];
          setUserRole(role);
          setUserName(profile.name);
        }
      }

      let initialCat = loadedCats.length > 0 ? loadedCats[0].name : '';

      if (!role.includes('admin')) {
         const firstContador = role.find(r => r.startsWith('contador_'));
         if (firstContador) {
           const catName = firstContador.replace('contador_', '').toLowerCase();
           const matchedCat = loadedCats.find(c => c.name.toLowerCase() === catName);
           if (matchedCat) initialCat = matchedCat.name;
           else initialCat = firstContador.replace('contador_', '');
         }
      }
      
      setActiveCategory(initialCat);

      // Fetch ingredients
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) {
        toast.error('Erro ao carregar insumos.');
      } else if (data) {
        setIngredients(data.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          minStock: item.min_stock,
          unitPrice: item.unit_price || 0,
          category: item.category,
        })));
      }
      setIsLoading(false);
    }
    init();
  }, [supabase]);

  // O usuário pode trocar de aba?
  const isLocked = !userRole?.includes('admin');

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

  const activeCatObj = categories.find(c => c.name === activeCategory);
  const activeColor = activeCatObj?.color || '#3b82f6';

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button onClick={() => window.history.back()} className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 transition-colors">
            ← Voltar
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contagem Diária</h1>
          <p className="text-sm text-gray-500">
            {userName ? `Olá, ${userName}!` : 'Registre o estoque atual.'}
          </p>
        </div>
      </header>

      {/* Tabs de Categoria */}
      <div className="px-4 pt-2 pb-4">
        {categories.length === 0 && !isLoading ? (
          <p className="text-sm text-red-500">Nenhum setor cadastrado no sistema.</p>
        ) : (
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl overflow-x-auto">
            {categories.map((cat) => {
              const hasAccess = userRole?.includes('admin') || userRole?.includes(`contador_${cat.name.toLowerCase()}`);
              const isDisabled = !hasAccess;
              const isActive = activeCategory === cat.name;
              return (
                <button
                  key={cat.id}
                  onClick={() => { if (!isDisabled) setActiveCategory(cat.name); }}
                  disabled={isDisabled}
                  style={isActive ? { backgroundColor: cat.color, color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' } : {}}
                  className={`flex-1 min-w-[100px] py-3 rounded-lg font-bold text-sm transition-all ${
                    isActive 
                      ? '' 
                      : isDisabled 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {cat.name}
                  {isDisabled && ' 🔒'}
                </button>
              );
            })}
          </div>
        )}
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
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 font-medium">Nenhum insumo cadastrado para {activeCategory}.</p>
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
          disabled={isSaving || !activeCategory}
          style={{ backgroundColor: (isSaving || !activeCategory) ? '#9ca3af' : activeColor }}
          className={`w-full font-bold py-4 rounded-xl shadow-md transition-colors text-white ${(isSaving || !activeCategory) ? 'cursor-not-allowed' : 'hover:opacity-90'}`}
        >
          {isSaving ? 'Salvando...' : activeCategory ? `Salvar Contagem — ${activeCategory}` : 'Selecione um setor'}
        </button>
      </div>
    </main>
  );
}