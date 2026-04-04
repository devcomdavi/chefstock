// src/types/index.ts

export type IngredientCategory = 'cozinha' | 'salao';
export type UserRole = 'admin' | 'contador_cozinha' | 'contador_salao';

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  minStock: number;
  category: IngredientCategory;
}

export interface DailyCount {
  ingredientId: string;
  actualAmount: number;
}

export interface PurchasingReportItem extends Ingredient {
  actualAmount: number;
  amountToBuy: number;
  isCritical: boolean;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}