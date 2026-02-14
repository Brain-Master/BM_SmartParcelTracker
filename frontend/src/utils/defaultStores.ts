/**
 * Площадки по умолчанию (для импорта заказов и т.д.).
 * Пользователь включает/выключает их чекбоксами и может добавлять свои через API.
 */

export interface DefaultStoreOption {
  slug: string;
  name: string;
}

/** Базовый список площадок по умолчанию */
export const DEFAULT_STORES: DefaultStoreOption[] = [
  { slug: 'AliExpress', name: 'AliExpress' },
  { slug: 'Ozon', name: 'Ozon' },
  { slug: 'Wildberries', name: 'Wildberries' },
  { slug: 'Amazon', name: 'Amazon' },
  { slug: 'eBay', name: 'eBay' },
  { slug: 'YandexMarket', name: 'Яндекс.Маркет' },
];

const STORE_VISIBILITY_KEY = 'store_visibility';

export function loadStoreVisibility(): string[] {
  try {
    const raw = localStorage.getItem(STORE_VISIBILITY_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return DEFAULT_STORES.map((s) => s.slug);
}

export function saveStoreVisibility(slugs: string[]) {
  localStorage.setItem(STORE_VISIBILITY_KEY, JSON.stringify(slugs));
}

/** Включённые площадки по умолчанию (для настроек — чекбоксы) */
export function getVisibleDefaultStores(): DefaultStoreOption[] {
  const visible = loadStoreVisibility();
  return DEFAULT_STORES.filter((s) => visible.includes(s.slug));
}

/** Для формы заказа: видимые дефолты + магазины из API; при совпадении slug приоритет у API (название). */
export function getAvailableStoresForForm(
  apiStores: { id: string; slug: string; name: string | null }[]
): { slug: string; name: string }[] {
  const visibleDefaults = getVisibleDefaultStores();
  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const d of visibleDefaults) {
    bySlug.set(d.slug, { slug: d.slug, name: d.name });
  }
  for (const s of apiStores) {
    bySlug.set(s.slug, { slug: s.slug, name: s.name || s.slug });
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}
