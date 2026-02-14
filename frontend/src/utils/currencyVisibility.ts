/** Shared: visible currencies for order form (synced with CurrenciesPage localStorage). */
export const CURRENCY_CODES = ['RUB', 'USD', 'EUR', 'CNY'] as const;
export const VISIBILITY_KEY = 'currency_visibility';

export const CURRENCY_LABELS: Record<string, string> = {
  RUB: 'RUB (₽)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
  CNY: 'CNY (¥)',
};

export function loadVisibility(): string[] {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return ['RUB', 'USD', 'EUR'];
}

/** Visible currency codes for use in order form dropdown (only these are shown). */
export function getVisibleCurrencyOptions(): string[] {
  const visible = loadVisibility();
  return CURRENCY_CODES.filter((c) => visible.includes(c));
}
