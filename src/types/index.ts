// src/types/index.ts

export type IngredientCategory = string;
export type UserRole = string[];

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  minStock: number;
  unitPrice: number;
  category: IngredientCategory;
  isCountable: boolean;
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