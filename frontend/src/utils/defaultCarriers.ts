/**
 * Службы доставки по умолчанию (для API трекинга и т.д.).
 * Пользователь включает/выключает их чекбоксами и может добавлять свои через API.
 */

export interface DefaultCarrierOption {
  slug: string;
  name: string;
}

/** Базовый список служб доставки по умолчанию */
export const DEFAULT_CARRIERS: DefaultCarrierOption[] = [
  { slug: 'cdek', name: 'СДЭК' },
  { slug: 'russian-post', name: 'Почта России' },
  { slug: 'dhl', name: 'DHL' },
  { slug: 'fedex', name: 'FedEx' },
  { slug: 'usps', name: 'USPS' },
  { slug: 'china-post', name: 'China Post' },
  { slug: 'boxberry', name: 'Boxberry' },
];

const CARRIER_VISIBILITY_KEY = 'carrier_visibility';

export function loadCarrierVisibility(): string[] {
  try {
    const raw = localStorage.getItem(CARRIER_VISIBILITY_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return DEFAULT_CARRIERS.map((c) => c.slug);
}

export function saveCarrierVisibility(slugs: string[]) {
  localStorage.setItem(CARRIER_VISIBILITY_KEY, JSON.stringify(slugs));
}

/** Включённые службы по умолчанию (для настроек — чекбоксы) */
export function getVisibleDefaultCarriers(): DefaultCarrierOption[] {
  const visible = loadCarrierVisibility();
  return DEFAULT_CARRIERS.filter((c) => visible.includes(c.slug));
}

/** Для формы посылки: видимые дефолты + службы из API; при совпадении slug приоритет у API. */
export function getAvailableCarriersForForm(
  apiCarriers: { id: string; slug: string; name: string | null }[]
): { slug: string; name: string }[] {
  const visibleDefaults = getVisibleDefaultCarriers();
  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const d of visibleDefaults) {
    bySlug.set(d.slug, { slug: d.slug, name: d.name });
  }
  for (const c of apiCarriers) {
    bySlug.set(c.slug, { slug: c.slug, name: c.name || c.slug });
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}
