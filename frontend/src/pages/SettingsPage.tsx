/**
 * Настройки: одна страница с вкладками — Магазины, Службы доставки, Валюты и курсы.
 */
import { useState } from 'react';
import { StoresPage } from './StoresPage';
import { CarriersPage } from './CarriersPage';
import { CurrenciesPage } from './CurrenciesPage';

type TabId = 'stores' | 'carriers' | 'currencies';

const TABS: { id: TabId; label: string }[] = [
  { id: 'stores', label: 'Магазины' },
  { id: 'carriers', label: 'Службы доставки' },
  { id: 'currencies', label: 'Валюты и курсы' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('stores');

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
        <span aria-hidden>⚙️</span>
        Настройки
      </h1>

      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <nav className="flex gap-1" aria-label="Вкладки настроек">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 border-b-transparent -mb-px'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div
        id="panel-stores"
        role="tabpanel"
        aria-labelledby="tab-stores"
        hidden={activeTab !== 'stores'}
      >
        {activeTab === 'stores' && <StoresPage embedded />}
      </div>
      <div
        id="panel-carriers"
        role="tabpanel"
        aria-labelledby="tab-carriers"
        hidden={activeTab !== 'carriers'}
      >
        {activeTab === 'carriers' && <CarriersPage embedded />}
      </div>
      <div
        id="panel-currencies"
        role="tabpanel"
        aria-labelledby="tab-currencies"
        hidden={activeTab !== 'currencies'}
      >
        {activeTab === 'currencies' && <CurrenciesPage embedded />}
      </div>
    </div>
  );
}
