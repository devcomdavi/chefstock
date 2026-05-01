'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import Skeleton from '@/components/Skeleton';
import { createEmployee, deleteEmployee, updateEmployee } from './actions';
import { PurchasingReportItem, Ingredient, Profile, UserRole, Category } from '@/types';

const getRoleLabel = (role: string) => {
  if (role === 'admin') return '👑 Administrador';
  if (role.startsWith('contador_')) {
    const catName = role.replace('contador_', '');
    return `📝 Contador ${catName.charAt(0).toUpperCase() + catName.slice(1)}`;
  }
  return role;
};

export default function AdminDashboardPage() {
  const supabase = createClient();

  // Estados principais
  const [categories, setCategories] = useState<Category[]>([]);
  const [report, setReport] = useState<PurchasingReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string | 'all'>('all');
  const [adminName, setAdminName] = useState('Gestor');

  // Estados para o formulário de novo insumo
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [category, setCategory] = useState<string>('');
  const [isCountable, setIsCountable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para o modal de edição de insumo
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editMinStock, setEditMinStock] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editIsCountable, setEditIsCountable] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Estados para o modal de categorias
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#f97316');

  // Estados para gestão de equipe
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<UserRole>([]);
  const [isCreatingEmp, setIsCreatingEmp] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

  // ─── DATA FETCHING ───

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch categorias
      const { data: cats, error: catsError } = await supabase.from('categories').select('*').order('name');
      if (catsError) throw catsError;
      setCategories(cats || []);
      
      // Select first category by default if empty
      if (cats && cats.length > 0) {
        if (!category) setCategory(cats[0].name);
        if (newEmpRole.length === 0) setNewEmpRole([`contador_${cats[0].name.toLowerCase()}`]);
      }

      // 2. Fetch ingredientes e contagens
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
          unitPrice: ingredient.unit_price || 0,
          category: ingredient.category,
          actualAmount,
          amountToBuy,
          isCritical: actualAmount === 0 || actualAmount < (minStockLimit / 2),
          isCountable: ingredient.is_countable ?? true,
        });
      });

      generatedReport.sort((a, b) => {
        if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
        return b.amountToBuy - a.amountToBuy;
      });

      setReport(generatedReport);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      toast.error('Erro ao carregar os dados. Verifique a tabela de categorias.');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredReport = filterCategory === 'all'
    ? report
    : report.filter((item) => item.category === filterCategory);

  // ─── HELPERS ───
  const getCategoryColor = (catName: string) => {
    const cat = categories.find(c => c.name === catName);
    return cat ? cat.color : '#6b7280';
  };

  // ─── CATEGORY HANDLERS ───
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const { error } = await supabase.from('categories').insert([{ name: newCatName.trim(), color: newCatColor }]);
      if (error) throw error;
      toast.success('Setor criado!');
      setNewCatName('');
      fetchDashboardData();
    } catch (err: unknown) {
      toast.error('Erro ao criar setor.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Deseja excluir este setor? Os insumos associados podem ficar órfãos.')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast.success('Setor excluído!');
      fetchDashboardData();
    } catch (err) {
      toast.error('Erro ao excluir setor.');
    }
  };

  // ─── INGREDIENT HANDLERS ───

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      toast.error('Crie um setor antes de adicionar insumos.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('ingredients')
        .insert([{ name, unit, min_stock: Number(minStock), unit_price: Number(unitPrice), category, is_countable: isCountable }]);
      if (error) throw error;
      toast.success('Insumo cadastrado com sucesso!');
      setName(''); setUnit(''); setMinStock(''); setUnitPrice(''); setIsCountable(true);
      fetchDashboardData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Verifique o console';
      toast.error(`Falha no banco: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (item: PurchasingReportItem) => {
    setEditingIngredient({ id: item.id, name: item.name, unit: item.unit, minStock: item.minStock, unitPrice: item.unitPrice, category: item.category, isCountable: item.isCountable });
    setEditName(item.name); setEditUnit(item.unit);
    setEditMinStock(item.minStock.toString()); setEditUnitPrice(item.unitPrice?.toString() || '0'); setEditCategory(item.category); setEditIsCountable(item.isCountable);
    setShowDeleteConfirm(false);
  };

  const closeEditModal = () => {
    setEditingIngredient(null); setEditName(''); setEditUnit('');
    setEditMinStock(''); setEditUnitPrice(''); setEditCategory(''); setEditIsCountable(true); setShowDeleteConfirm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingIngredient) return;
    if (!editName.trim() || !editMinStock || isNaN(Number(editMinStock))) {
      toast.error('Preencha corretamente.'); return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('ingredients').update({
        name: editName.trim(), unit: editUnit,
        min_stock: Number(editMinStock), unit_price: Number(editUnitPrice), category: editCategory, is_countable: editIsCountable,
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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const { error } = await supabase.from('ingredients')
        .update({ active: false }).in('id', selectedIds);
      if (error) throw error;
      toast.success(`${selectedIds.length} insumos excluídos!`);
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Erro ao excluir insumos:', error);
      toast.error('Erro ao excluir em massa.');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // ─── TEAM HANDLERS ───

  const openTeamModal = () => {
    setShowTeamModal(true);
    setEditingEmpId(null);
    setNewEmpName(''); setNewEmpEmail(''); setNewEmpPassword(''); setNewEmpRole([]);
    fetchEmployees();
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingEmp(true);
    const formData = new FormData();
    formData.append('name', newEmpName);
    formData.append('email', newEmpEmail);
    formData.append('password', newEmpPassword);
    formData.append('role', JSON.stringify(newEmpRole));

    const result = editingEmpId 
      ? await updateEmployee(editingEmpId, formData)
      : await createEmployee(formData);
      
    if (result.error) {
      toast.error(`Erro: ${result.error}`);
    } else {
      toast.success(editingEmpId ? 'Funcionário atualizado com sucesso!' : 'Funcionário cadastrado com sucesso!');
      setNewEmpName(''); setNewEmpEmail(''); setNewEmpPassword(''); setNewEmpRole([]);
      setEditingEmpId(null);
      fetchEmployees();
    }
    setIsCreatingEmp(false);
  };

  const handleEditEmployee = (emp: Profile) => {
    setEditingEmpId(emp.id);
    setNewEmpName(emp.name);
    setNewEmpEmail(emp.email);
    setNewEmpPassword(''); // Do not load password
    setNewEmpRole(emp.role as UserRole);
  };
  
  const cancelEditEmployee = () => {
    setEditingEmpId(null);
    setNewEmpName(''); setNewEmpEmail(''); setNewEmpPassword(''); setNewEmpRole([]);
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

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const totalCost = itemsToBuy.reduce((sum, item) => sum + (item.amountToBuy * (item.unitPrice || 0)), 0);
    const totalCostStr = totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const buildTable = (items: PurchasingReportItem[], title: string, color: string) => {
      if (items.length === 0) return '';
      const rows = items.map((item, i) => `
        <tr style="${i % 2 === 0 ? 'background:#f9fafb;' : ''}">
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.actualAmount} ${item.unit}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.minStock} ${item.unit}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">R$ ${(item.unitPrice || 0).toFixed(2)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:${color};">
            ${item.amountToBuy} ${item.unit}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:#047857;">
            R$ ${(item.amountToBuy * (item.unitPrice || 0)).toFixed(2)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">
            <span style="display:inline-block;width:18px;height:18px;border:2px solid #9ca3af;border-radius:3px;"></span>
          </td>
        </tr>
      `).join('');
      return `
        <h2 style="margin:24px 0 8px;font-size:16px;color:${color};border-bottom:2px solid ${color};padding-bottom:6px;">${title} (${items.length} itens)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#1f2937;color:white;">
              <th style="padding:10px 12px;text-align:left;">Insumo</th>
              <th style="padding:10px 12px;text-align:center;">Estoque</th>
              <th style="padding:10px 12px;text-align:center;">Mínimo</th>
              <th style="padding:10px 12px;text-align:center;">Preço Un.</th>
              <th style="padding:10px 12px;text-align:center;">Qtd Comprar</th>
              <th style="padding:10px 12px;text-align:center;">Subtotal</th>
              <th style="padding:10px 12px;text-align:center;width:60px;">✓</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    };

    const tablesHtml = categories.map(cat => {
      const catItems = itemsToBuy.filter(i => i.category === cat.name);
      return buildTable(catItems, cat.name, cat.color);
    }).join('');

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
            <strong style="color:#374151;">Total de itens:</strong> ${itemsToBuy.length}<br>
            <strong style="color:#374151;font-size:16px;">Custo Estimado: <span style="color:#047857;">${totalCostStr}</span></strong>
          </div>
        </div>

        ${itemsToBuy.length === 0
        ? '<p style="text-align:center;color:#6b7280;padding:40px 0;font-size:16px;">✅ Nenhum item precisa ser comprado!</p>'
        : tablesHtml
      }

        <div style="margin-top:40px;padding-top:16px;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;font-size:12px;color:#9ca3af;">
          <span>ChefStock — Gestão inteligente de estoque</span>
          <span>Gerado em ${timeStr} de ${dateStr}</span>
        </div>

        <div class="no-print" style="display:flex; justify-content:center; gap: 16px; margin-top:30px;">
          <button onclick="window.location.reload()" style="background:#6b7280;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;">Voltar</button>
          <button onclick="window.print()" style="background:#f97316;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;">Imprimir / Salvar PDF</button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_self');
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
          <button onClick={() => setShowCategoryModal(true)} className="bg-green-500 text-black px-5 py-2 rounded-lg font-medium hover:bg-green-600 transition-colors">
            🏷️ Setores
          </button>
          <button onClick={() => window.location.href = '/contador'} className="bg-orange-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors">
            👁️ Visão Colaborador
          </button>
          <button onClick={openTeamModal} className="bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors">
            👥 Equipe
          </button>
          <button onClick={handlePrint} className="bg-gray-800 text-white px-5 py-2 rounded-lg font-medium hover:bg-gray-900 transition-colors">
            🖨️ Lista de Compras
          </button>
          <button onClick={handleLogout} className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">
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
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Alho Descascado"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Setor</label>
                {categories.length === 0 ? (
                  <p className="text-sm text-red-500">Cadastre um setor primeiro.</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {categories.map((cat) => (
                      <button key={cat.id} type="button" onClick={() => setCategory(cat.name)}
                        style={category === cat.name ? { borderColor: cat.color, backgroundColor: `${cat.color}20`, color: cat.color } : {}}
                        className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-sm font-bold border-2 transition-all ${category === cat.name
                            ? '' : 'border-gray-200 bg-white text-black hover:border-gray-300'
                          }`}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <input type="text" required value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ex: kg, litros, pct"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mín.</label>
                  <input type="number" required min="0" step="0.1" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="Ex: 5"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unitário (R$)</label>
                <input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Ex: 10.50"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isCountableNew" checked={isCountable} onChange={(e) => setIsCountable(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                <label htmlFor="isCountableNew" className="text-sm font-medium text-gray-700 cursor-pointer">Produto Contável (usa Contador numérico)</label>
              </div>
              <button type="submit" disabled={isSubmitting}
                className={`w-full font-bold py-2.5 rounded-lg transition-colors text-white ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
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
              <div className="flex items-center gap-4 flex-wrap">
                {selectedIds.length > 0 && (
                  <button onClick={() => setShowBulkDeleteConfirm(true)} disabled={isDeletingBulk} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                    {isDeletingBulk ? 'Excluindo...' : `Excluir ${selectedIds.length}`}
                  </button>
                )}
                <div className="text-sm font-semibold bg-green-100 text-black px-3 py-1.5 rounded-lg border border-green-200">
                  Total da Lista: R$ {filteredReport.reduce((acc, item) => acc + (item.amountToBuy * (item.unitPrice || 0)), 0).toFixed(2)}
                </div>
                <div className="flex gap-1 bg-gray-200 p-0.5 rounded-lg overflow-x-auto">
                  <button onClick={() => setFilterCategory('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterCategory === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}>Todos</button>
                  {categories.map((cat) => (
                    <button key={cat.id} onClick={() => setFilterCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterCategory === cat.name ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}>{cat.name}</button>
                  ))}
                </div>
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
                      <th className="p-4 font-medium w-12 text-center">
                        <input type="checkbox" 
                          checked={filteredReport.length > 0 && selectedIds.length === filteredReport.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(filteredReport.map(i => i.id));
                            else setSelectedIds([]);
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-4 font-medium">Insumo</th>
                      <th className="p-4 font-medium text-center">Setor</th>
                      <th className="p-4 font-medium text-center">Estoque Atual</th>
                      <th className="p-4 font-medium text-center">Limite Mín.</th>
                      <th className="p-4 font-medium text-center">Preço Un.</th>
                      <th className="p-4 font-medium text-right text-blue-600">Comprar</th>
                      <th className="p-4 font-medium text-right text-green-600">Subtotal</th>
                      <th className="p-4 font-medium text-center w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReport.map((item) => {
                      const catColor = getCategoryColor(item.category);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-center">
                            <input type="checkbox" 
                              checked={selectedIds.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds(prev => [...prev, item.id]);
                                else setSelectedIds(prev => prev.filter(id => id !== item.id));
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-gray-800 flex items-center gap-2">
                              {item.isCritical && item.amountToBuy > 0 && <span className="w-2 h-2 rounded-full bg-red-500" />}
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500">Unidade: {item.unit}</div>
                          </td>
                          <td className="p-4 text-center">
                            <span style={{ backgroundColor: `${catColor}15`, color: catColor, borderColor: `${catColor}30` }} className="inline-block px-2.5 py-1 rounded-full text-xs font-bold border">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-4 text-center text-gray-600 font-medium">{item.actualAmount}</td>
                          <td className="p-4 text-center text-gray-600 font-medium">{item.minStock}</td>
                          <td className="p-4 text-center text-gray-600 font-medium">R$ {item.unitPrice?.toFixed(2) || '0.00'}</td>
                          <td className="p-4 text-right">
                            {item.amountToBuy > 0 ? (
                              <span className={`inline-block px-3 py-1 rounded-md font-bold text-sm border ${item.isCritical ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}>+ {item.amountToBuy} {item.unit}</span>
                            ) : (
                              <span className="text-green-500 font-medium text-sm">Estoque OK</span>
                            )}
                          </td>
                          <td className="p-4 text-right text-gray-800 font-bold">
                            {item.amountToBuy > 0 ? `R$ ${(item.amountToBuy * (item.unitPrice || 0)).toFixed(2)}` : '-'}
                          </td>
                          <td className="p-4 text-center">
                            <button onClick={() => openEditModal(item)}
                              className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-all" title="Editar">✎</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Modal de Confirmação de Exclusão em Massa ─── */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Excluir {selectedIds.length} insumos?</h3>
            <p className="text-gray-600 mb-6 text-sm">Esta ação desativará os insumos selecionados e eles não aparecerão mais nas listas de contagem. Deseja continuar?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkDeleteConfirm(false)} disabled={isDeletingBulk} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">Não, voltar</button>
              <button onClick={handleBulkDelete} disabled={isDeletingBulk} className={`flex-1 px-4 py-2 rounded-lg font-bold text-white transition-colors ${isDeletingBulk ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isDeletingBulk ? 'Excluindo...' : 'Sim, excluir'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de Categorias ─── */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCategoryModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Gerenciar Setores</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">✕</button>
            </div>
            <div className="p-6">
              <form onSubmit={handleCreateCategory} className="flex gap-2 items-end mb-6">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome do Setor</label>
                  <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} required placeholder="Ex: Bar" className="w-full p-2 border border-gray-300 rounded-lg outline-none text-black text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cor</label>
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-10 h-10 p-0 border-0 rounded-lg cursor-pointer" />
                </div>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 h-10">Add</button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="font-medium text-gray-800 text-sm">{cat.name}</span>
                    </div>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Excluir</button>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-gray-500 text-center">Nenhum setor cadastrado.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Setor</label>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((cat) => (
                    <button key={cat.id} type="button" onClick={() => setEditCategory(cat.name)}
                      style={editCategory === cat.name ? { borderColor: cat.color, backgroundColor: `${cat.color}20`, color: cat.color } : {}}
                      className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-sm font-bold border-2 transition-all ${editCategory === cat.name
                          ? '' : 'border-gray-200 bg-white text-black hover:border-gray-300'
                        }`}>{cat.name}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <input type="text" required value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder="Ex: kg, litros, pct"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limite Mín.</label>
                  <input type="number" min="0" step="0.1" value={editMinStock} onChange={(e) => setEditMinStock(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unitário (R$)</label>
                <input type="number" min="0" step="0.01" value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isCountableEdit" checked={editIsCountable} onChange={(e) => setEditIsCountable(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                <label htmlFor="isCountableEdit" className="text-sm font-medium text-gray-700 cursor-pointer">Produto Contável (usa Contador numérico)</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 space-y-3">
              <div className="flex gap-3">
                <button onClick={closeEditModal} disabled={isUpdating}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                <button onClick={handleSaveEdit} disabled={isUpdating}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-white transition-colors ${isUpdating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
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
                        className={`flex-1 px-3 py-2 text-sm rounded-lg font-bold text-white transition-colors ${isUpdating ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
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
              {/* Formulário de novo/editar funcionário */}
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                    {editingEmpId ? 'Editar Funcionário' : 'Cadastrar Funcionário'}
                  </h4>
                  {editingEmpId && (
                    <button type="button" onClick={cancelEditEmployee} className="text-xs text-gray-500 hover:text-gray-700 underline">
                      Cancelar Edição
                    </button>
                  )}
                </div>
                <form onSubmit={handleSaveEmployee} className="space-y-3">
                  <input type="text" required value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="Nome completo" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm text-black" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="email" required value={newEmpEmail} onChange={(e) => setNewEmpEmail(e.target.value)}
                      placeholder="Email" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm text-black" />
                    <input type="password" required={!editingEmpId} minLength={6} value={newEmpPassword} onChange={(e) => setNewEmpPassword(e.target.value)}
                      placeholder={editingEmpId ? "Nova senha (opcional)" : "Senha (mín. 6)"} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm text-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de Perfil</label>
                    <select
                      value={newEmpRole.includes('admin') ? 'admin' : 'colaborador'}
                      onChange={(e) => {
                        if (e.target.value === 'admin') {
                          setNewEmpRole(['admin']);
                        } else {
                          setNewEmpRole([]);
                        }
                      }}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm text-black bg-white mb-3"
                    >
                      <option value="colaborador">👤 Colaborador (Acesso restrito a setores)</option>
                      <option value="admin">👑 Administrador (Acesso total)</option>
                    </select>

                    {!newEmpRole.includes('admin') && (
                      <>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Setores Permitidos</label>
                        <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 bg-white">
                          <div className="mb-2 pb-2 border-b border-gray-100">
                            <label className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-md cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                              <input 
                                type="checkbox" 
                                checked={newEmpRole.length === categories.length && categories.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewEmpRole(categories.map(c => `contador_${c.name.toLowerCase()}`));
                                  } else {
                                    setNewEmpRole([]);
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300 cursor-pointer text-blue-600 focus:ring-blue-500 shrink-0"
                              />
                              <span className="text-sm font-bold text-gray-800">✅ Selecionar Todos</span>
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-1">
                            {categories.map((cat) => {
                              const roleValue = `contador_${cat.name.toLowerCase()}`;
                              const isSelected = newEmpRole.includes(roleValue);
                              return (
                                <label key={cat.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-md cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={(e) => {
                                      setNewEmpRole(prev => e.target.checked ? [...prev, roleValue] : prev.filter(r => r !== roleValue));
                                    }}
                                    style={{ accentColor: cat.color }}
                                    className="w-4 h-4 rounded border-gray-300 cursor-pointer shrink-0"
                                  />
                                  <span className="text-xs text-gray-700 font-medium truncate" title={`Contador ${cat.name}`}>📝 Contador {cat.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button type="submit" disabled={isCreatingEmp}
                    className={`w-full font-bold py-2.5 rounded-lg text-white text-sm transition-colors ${isCreatingEmp ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                      }`}>
                    {isCreatingEmp ? 'Salvando...' : (editingEmpId ? 'Salvar Alterações' : 'Cadastrar Funcionário')}
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
                      <div 
                        key={emp.id} 
                        onClick={() => {
                          if (!emp.role?.includes('admin')) {
                            handleEditEmployee(emp);
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-lg border border-gray-100 transition-colors ${!emp.role?.includes('admin') ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer' : 'bg-gray-50'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-800 text-sm truncate">{emp.name}</div>
                          <div className="text-xs text-gray-500 truncate">{emp.email}</div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-wrap justify-end">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${emp.role?.includes('admin') ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            {emp.role?.includes('admin') ? '👑 Administrador' : '👤 Colaborador'}
                          </span>
                          {!emp.role?.includes('admin') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEmployee(emp.id, emp.name);
                              }}
                              className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors" 
                              title="Remover"
                            >
                              ✕
                            </button>
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