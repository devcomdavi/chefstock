// src/app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import Skeleton from '@/components/Skeleton';
import { createEmployee, deleteEmployee } from './actions';
import { PurchasingReportItem, Ingredient, IngredientCategory, Profile, UserRole } from '@/types';

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  cozinha: '👨‍🍳 Cozinha',
  salao: '🍽️ Salão',
};

const CATEGORY_BADGE_STYLES: Record<IngredientCategory, string> = {
  cozinha: 'bg-orange-50 text-orange-700 border-orange-200',
  salao: 'bg-blue-50 text-blue-700 border-blue-200',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '👑 Administrador',
  contador_cozinha: '👨‍🍳 Contador Cozinha',
  contador_salao: '🍽️ Contador Salão',
};

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  contador_cozinha: 'bg-orange-50 text-orange-700 border-orange-200',
  contador_salao: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function AdminDashboardPage() {
  const supabase = createClient();

  // Estados para o formulário de novo insumo
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [minStock, setMinStock] = useState('');
  const [category, setCategory] = useState<IngredientCategory>('cozinha');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para o relatório e filtro
  const [report, setReport] = useState<PurchasingReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<IngredientCategory | 'all'>('all');
  const [adminName, setAdminName] = useState('Gestor');

  // Estados para o modal de edição de insumo
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editMinStock, setEditMinStock] = useState('');
  const [editCategory, setEditCategory] = useState<IngredientCategory>('cozinha');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Estados para gestão de equipe
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<UserRole>('contador_cozinha');
  const [isCreatingEmp, setIsCreatingEmp] = useState(false);

  // ─── DATA FETCHING ───

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('*')
        .eq('active', true);

      if (ingredientsError) throw ingredientsError;

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: counts, error: countsError } = await supabase
        .from('daily_counts')
        .select('*')
        .gte('counted_at', yesterday)
        .order('counted_at', { ascending: false });

      if (countsError) throw countsError;

      const generatedReport: PurchasingReportItem[] = [];

      ingredients?.forEach((ingredient) => {
        const latestCount = counts?.find(c => c.ingredient_id === ingredient.id);
        const actualAmount = latestCount ? Number(latestCount.actual_amount) : 0;
        const minStockLimit = Number(ingredient.min_stock);
        const amountToBuy = actualAmount < minStockLimit ? minStockLimit - actualAmount : 0;

        generatedReport.push({
          id: ingredient.id,
          name: ingredient.name,
          unit: ingredient.unit,
          minStock: minStockLimit,
          category: (ingredient.category as IngredientCategory) || 'cozinha',
          actualAmount,
          amountToBuy,
          isCritical: actualAmount === 0 || actualAmount < (minStockLimit / 2),
        });
      });

      generatedReport.sort((a, b) => {
        if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
        return b.amountToBuy - a.amountToBuy;
      });

      setReport(generatedReport);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      toast.error('Erro ao carregar o relatório de compras.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setIsLoadingTeam(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEmployees(data.map(p => ({
        id: p.id,
        email: p.email,
        name: p.name,
        role: p.role as UserRole,
      })));
    }
    setIsLoadingTeam(false);
  };

  useEffect(() => {
    fetchDashboardData();
    // Busca o nome do admin logado
    async function fetchAdminName() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('name').eq('id', user.id).single();
        if (profile?.name) setAdminName(profile.name);
      }
    }
    fetchAdminName();
  }, []);

  const filteredReport = filterCategory === 'all'
    ? report
    : report.filter((item) => item.category === filterCategory);

  // ─── INGREDIENT HANDLERS ───

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('ingredients')
        .insert([{ name, unit, min_stock: Number(minStock), category }]);
      if (error) throw error;
      toast.success('Insumo cadastrado com sucesso!');
      setName(''); setUnit('kg'); setMinStock(''); setCategory('cozinha');
      fetchDashboardData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Verifique o console';
      toast.error(`Falha no banco: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (item: PurchasingReportItem) => {
    setEditingIngredient({ id: item.id, name: item.name, unit: item.unit, minStock: item.minStock, category: item.category });
    setEditName(item.name); setEditUnit(item.unit);
    setEditMinStock(item.minStock.toString()); setEditCategory(item.category);
    setShowDeleteConfirm(false);
  };

  const closeEditModal = () => {
    setEditingIngredient(null); setEditName(''); setEditUnit('');
    setEditMinStock(''); setEditCategory('cozinha'); setShowDeleteConfirm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingIngredient) return;
    if (!editName.trim() || !editMinStock || isNaN(Number(editMinStock))) {
      toast.error('Preencha preencher corretamente.'); return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('ingredients').update({
        name: editName.trim(), unit: editUnit,
        min_stock: Number(editMinStock), category: editCategory,
      }).eq('id', editingIngredient.id);
      if (error) throw error;
      closeEditModal(); fetchDashboardData();
    } catch (error) {
      console.error('Erro ao atualizar insumo:', error);
      toast.error('Erro ao atualizar o insumo.');
    } finally { setIsUpdating(false); }
  };

  const handleDeleteIngredient = async () => {
    if (!editingIngredient) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('ingredients')
        .update({ active: false }).eq('id', editingIngredient.id);
      if (error) throw error;
      closeEditModal(); fetchDashboardData();
    } catch (error) {
      console.error('Erro ao excluir insumo:', error);
      toast.error('Erro ao excluir o insumo.');
    } finally { setIsUpdating(false); }
  };

  // ─── TEAM HANDLERS ───

  const openTeamModal = () => {
    setShowTeamModal(true);
    fetchEmployees();
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingEmp(true);
    const formData = new FormData();
    formData.append('name', newEmpName);
    formData.append('email', newEmpEmail);
    formData.append('password', newEmpPassword);
    formData.append('role', newEmpRole);

    const result = await createEmployee(formData);
    if (result.error) {
      toast.error(`Erro: ${result.error}`);
    } else {
      setNewEmpName(''); setNewEmpEmail(''); setNewEmpPassword('');
      setNewEmpRole('contador_cozinha');
      fetchEmployees();
    }
    setIsCreatingEmp(false);
  };

  const handleDeleteEmployee = async (userId: string, empName: string) => {
    if (!confirm(`Remover "${empName}"? Esta ação não pode ser desfeita.`)) return;
    const result = await deleteEmployee(userId);
    if (result.error) {
      toast.error(`Erro: ${result.error}`);
    } else {
      fetchEmployees();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // ─── IMPRESSÃO FORMATADA ───

  const handlePrint = () => {
    const itemsToBuy = report.filter((item) => item.amountToBuy > 0);
    const cozinhaItems = itemsToBuy.filter((i) => i.category === 'cozinha');
    const salaoItems = itemsToBuy.filter((i) => i.category === 'salao');

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const buildTable = (items: PurchasingReportItem[], title: string) => {
      if (items.length === 0) return '';
      const rows = items.map((item, i) => `
        <tr style="${i % 2 === 0 ? 'background:#f9fafb;' : ''}">
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.actualAmount} ${item.unit}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.minStock} ${item.unit}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:#1d4ed8;">
            ${item.amountToBuy} ${item.unit}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">
            <span style="display:inline-block;width:18px;height:18px;border:2px solid #9ca3af;border-radius:3px;"></span>
          </td>
        </tr>
      `).join('');
      return `
        <h2 style="margin:24px 0 8px;font-size:16px;color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:6px;">${title} (${items.length} itens)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#1f2937;color:white;">
              <th style="padding:10px 12px;text-align:left;">Insumo</th>
              <th style="padding:10px 12px;text-align:center;">Estoque</th>
              <th style="padding:10px 12px;text-align:center;">Mínimo</th>
              <th style="padding:10px 12px;text-align:center;">Comprar</th>
              <th style="padding:10px 12px;text-align:center;width:60px;">✓</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    };

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Lista de Compras — ChefStock</title>
        <style>
          @page { margin: 20mm 15mm; }
          body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 0; padding: 24px 40px; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div style="text-align:center;margin-bottom:24px;border-bottom:3px solid #f97316;padding-bottom:16px;">
          <h1 style="margin:0;font-size:28px;color:#1f2937;">🍳 ChefStock</h1>
          <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">Lista de Compras</p>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px;color:#6b7280;">
          <div>
            <strong style="color:#374151;">Data:</strong> ${dateStr}<br>
            <strong style="color:#374151;">Hora:</strong> ${timeStr}
          </div>
          <div style="text-align:right;">
            <strong style="color:#374151;">Responsável:</strong> ${adminName}<br>
            <strong style="color:#374151;">Total de itens:</strong> ${itemsToBuy.length}
          </div>
        </div>

        ${itemsToBuy.length === 0 
          ? '<p style="text-align:center;color:#6b7280;padding:40px 0;font-size:16px;">✅ Nenhum item precisa ser comprado!</p>'
          : buildTable(cozinhaItems, '👨‍🍳 Cozinha') + buildTable(salaoItems, '🍽️ Salão')
        }

        <div style="margin-top:40px;padding-top:16px;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;font-size:12px;color:#9ca3af;">
          <span>ChefStock — Gestão inteligente de estoque</span>
          <span>Gerado em ${timeStr} de ${dateStr}</span>
        </div>

        <div class="no-print" style="text-align:center;margin-top:30px;">
          <button onclick="window.print()" style="background:#f97316;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;">Imprimir / Salvar PDF</button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  // ─── RENDER ───

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Painel do Gestor</h1>
          <p className="text-gray-500 mt-1">Gerencie insumos, equipe e relatório de compras.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => window.open('/contador', '_blank')}
            className="bg-orange-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            👁️ Visão Funcionário
          </button>
          <button
            onClick={openTeamModal}
            className="bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            👥 Equipe
          </button>
          <button
            onClick={handlePrint}
            className="bg-gray-800 text-white px-5 py-2 rounded-lg font-medium hover:bg-gray-900 transition-colors"
          >
            🖨️ Lista de Compras
          </button>
          <button
            onClick={handleLogout}
            className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de novo insumo */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Novo Insumo</h2>
            <form onSubmit={handleAddIngredient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Insumo</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Alho Descascado"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                <div className="flex gap-2">
                  {(Object.keys(CATEGORY_LABELS) as IngredientCategory[]).map((cat) => (
                    <button key={cat} type="button" onClick={() => setCategory(cat)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border-2 transition-all ${
                        category === cat
                          ? cat === 'cozinha' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}>
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black">
                    <option value="kg">Quilo (kg)</option>
                    <option value="litros">Litro (l)</option>
                    <option value="unidade">Unidade (un)</option>
                    <option value="maço">Maço</option>
                    <option value="pote">Pote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mín.</label>
                  <input type="number" required min="0" step="0.1" value={minStock}
                    onChange={(e) => setMinStock(e.target.value)} placeholder="Ex: 5"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting}
                className={`w-full font-bold py-2.5 rounded-lg transition-colors text-white ${
                  isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                {isSubmitting ? 'Cadastrando...' : 'Cadastrar Insumo'}
              </button>
            </form>
          </div>
        </div>

        {/* Tabela de estoque */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">Status do Estoque</h2>
              <div className="flex gap-1 bg-gray-200 p-0.5 rounded-lg">
                <button onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    filterCategory === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>Todos</button>
                {(Object.keys(CATEGORY_LABELS) as IngredientCategory[]).map((cat) => (
                  <button key={cat} onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      filterCategory === cat ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>{CATEGORY_LABELS[cat]}</button>
                ))}
              </div>
            </div>
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                      <th className="p-4 font-medium">Insumo</th>
                      <th className="p-4 font-medium text-center">Categoria</th>
                      <th className="p-4 font-medium text-center">Estoque Atual</th>
                      <th className="p-4 font-medium text-center">Limite Mín.</th>
                      <th className="p-4 font-medium text-right text-blue-600">Comprar</th>
                      <th className="p-4 font-medium text-center w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReport.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="font-semibold text-gray-800 flex items-center gap-2">
                            {item.isCritical && item.amountToBuy > 0 && <span className="w-2 h-2 rounded-full bg-red-500" />}
                            {item.name}
                          </div>
                          <div className="text-xs text-gray-500">Unidade: {item.unit}</div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${CATEGORY_BADGE_STYLES[item.category]}`}>
                            {item.category === 'cozinha' ? 'Cozinha' : 'Salão'}
                          </span>
                        </td>
                        <td className="p-4 text-center text-gray-600 font-medium">{item.actualAmount}</td>
                        <td className="p-4 text-center text-gray-600 font-medium">{item.minStock}</td>
                        <td className="p-4 text-right">
                          {item.amountToBuy > 0 ? (
                            <span className={`inline-block px-3 py-1 rounded-md font-bold text-sm border ${
                              item.isCritical ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                            }`}>+ {item.amountToBuy} {item.unit}</span>
                          ) : (
                            <span className="text-green-500 font-medium text-sm">Estoque OK</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => openEditModal(item)}
                            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-all" title="Editar">✎</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Modal de Edição de Insumo ─── */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeEditModal}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Editar Insumo</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                <div className="flex gap-2">
                  {(Object.keys(CATEGORY_LABELS) as IngredientCategory[]).map((cat) => (
                    <button key={cat} type="button" onClick={() => setEditCategory(cat)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border-2 transition-all ${
                        editCategory === cat
                          ? cat === 'cozinha' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}>{CATEGORY_LABELS[cat]}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black">
                    <option value="kg">Quilo (kg)</option>
                    <option value="litros">Litro (l)</option>
                    <option value="unidade">Unidade (un)</option>
                    <option value="maço">Maço</option>
                    <option value="pote">Pote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limite Mín.</label>
                  <input type="number" min="0" step="0.1" value={editMinStock} onChange={(e) => setEditMinStock(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 space-y-3">
              <div className="flex gap-3">
                <button onClick={closeEditModal} disabled={isUpdating}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                <button onClick={handleSaveEdit} disabled={isUpdating}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-white transition-colors ${
                    isUpdating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}>{isUpdating ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
              <div className="pt-3 border-t border-gray-100">
                {!showDeleteConfirm ? (
                  <button onClick={() => setShowDeleteConfirm(true)} disabled={isUpdating}
                    className="w-full text-sm text-red-500 hover:text-red-700 hover:bg-red-50 py-2 rounded-lg font-medium transition-colors">
                    Excluir este insumo
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm text-red-700 font-medium text-center">Tem certeza? O insumo será desativado.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDeleteConfirm(false)} disabled={isUpdating}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-white transition-colors">Não, voltar</button>
                      <button onClick={handleDeleteIngredient} disabled={isUpdating}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg font-bold text-white transition-colors ${
                          isUpdating ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                        }`}>{isUpdating ? 'Excluindo...' : 'Sim, excluir'}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de Gestão de Equipe ─── */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowTeamModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">👥 Gestão de Equipe</h3>
              <button onClick={() => setShowTeamModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">✕</button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Formulário de novo funcionário */}
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Cadastrar Funcionário</h4>
                <form onSubmit={handleCreateEmployee} className="space-y-3">
                  <input type="text" required value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="Nome completo" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm text-black" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="email" required value={newEmpEmail} onChange={(e) => setNewEmpEmail(e.target.value)}
                      placeholder="Email" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm text-black" />
                    <input type="password" required minLength={6} value={newEmpPassword} onChange={(e) => setNewEmpPassword(e.target.value)}
                      placeholder="Senha (mín. 6)" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm text-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
                    <div className="flex gap-2">
                      {(['contador_cozinha', 'contador_salao', 'admin'] as UserRole[]).map((role) => (
                        <button key={role} type="button" onClick={() => setNewEmpRole(role)}
                          className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold border-2 transition-all ${
                            newEmpRole === role
                              ? `${ROLE_BADGE_STYLES[role].replace('bg-', 'border-').replace('-50', '-500').split(' ')[0]} ${ROLE_BADGE_STYLES[role]}`
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}>
                          {ROLE_LABELS[role]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="submit" disabled={isCreatingEmp}
                    className={`w-full font-bold py-2.5 rounded-lg text-white text-sm transition-colors ${
                      isCreatingEmp ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                    }`}>
                    {isCreatingEmp ? 'Cadastrando...' : 'Cadastrar Funcionário'}
                  </button>
                </form>
              </div>

              {/* Lista de funcionários */}
              <div className="p-6">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Funcionários ({employees.length})
                </h4>
                {isLoadingTeam ? (
                  <div className="space-y-3 py-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : employees.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">Nenhum funcionário cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {employees.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-800 text-sm truncate">{emp.name}</div>
                          <div className="text-xs text-gray-500 truncate">{emp.email}</div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${ROLE_BADGE_STYLES[emp.role]}`}>
                            {emp.role === 'admin' ? 'Admin' : emp.role === 'contador_cozinha' ? 'Cozinha' : 'Salão'}
                          </span>
                          {emp.role !== 'admin' && (
                            <button onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors" title="Remover">✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}