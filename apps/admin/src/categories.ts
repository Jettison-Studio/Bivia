import { categories, type Category } from '@bivia/core';
export type EditorialCategory = Category & { description?: string; sort_order?: number };
export const categoryStorageKey = 'bivia.categories.v1';
export function loadLocalCategories(): EditorialCategory[] {
  const defaults = [...categories, { id: 'mixed', name: 'All topics', icon: 'shuffle', color: '#5f00e6' }].map((category, index) => ({ ...category, description: '', sort_order: index }));
  try { const raw = localStorage.getItem(categoryStorageKey); if (!raw) return defaults; const value: unknown = JSON.parse(raw); if (!Array.isArray(value) || !value.every(c => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.color === 'string' && typeof c.icon === 'string')) return defaults; return value as EditorialCategory[]; } catch { return defaults; }
}
export function validateCategory(category: EditorialCategory): string[] {
  const errors = [];
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(category.id)) errors.push('Use a category ID of 1–50 lowercase letters, numbers, or hyphens.');
  if (!category.name.trim() || category.name.trim().length > 80) errors.push('Enter a category name of 1–80 characters.');
  if (!/^#[a-f0-9]{6}$/i.test(category.color)) errors.push('Choose a six-digit hex color, such as #5f00e6.');
  if (!category.icon.trim() || category.icon.length > 50) errors.push('Choose an icon name of 1–50 characters.');
  if (!Number.isInteger(category.sort_order ?? 0) || Math.abs(category.sort_order ?? 0) > 10000) errors.push('Display order must be a whole number from -10000 to 10000.');
  return errors;
}
