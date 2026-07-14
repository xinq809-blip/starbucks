import { createContext, useContext, useReducer, useEffect, useCallback, useState, type ReactNode } from 'react';
import type { Product, Distributor, WeeklySnapshot, MonthlyTarget, RestockRecord } from '../types';
import { products as initialProducts, distributors as initialDistributors } from '../data/mockData';
import { supabase } from '../lib/supabase';

interface AppState {
  products: Product[];
  distributors: Distributor[];
  snapshots: WeeklySnapshot[];
  restocks: RestockRecord[];
  targets: MonthlyTarget[];
  loaded: boolean;
}

type Action =
  | { type: 'INIT_DATA'; payload: { snapshots: WeeklySnapshot[]; restocks: RestockRecord[]; targets: MonthlyTarget[] } }
  | { type: 'SET_SNAPSHOTS'; payload: WeeklySnapshot[] }
  | { type: 'SET_RESTOCKS'; payload: RestockRecord[] }
  | { type: 'SET_TARGETS'; payload: MonthlyTarget[] }
  | { type: 'SET_DISTRIBUTORS'; payload: Distributor[] }
  | { type: 'SAVE_WEEK_DONE'; payload: WeeklySnapshot[] }
  | { type: 'SET_TARGET'; payload: MonthlyTarget }
  | { type: 'ADD_RESTOCK_DONE'; payload: RestockRecord[] }
  | { type: 'DELETE_RESTOCK_DONE'; payload: RestockRecord[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT_DATA':
      return { ...state, ...action.payload, loaded: true };
    case 'SET_SNAPSHOTS':
      return { ...state, snapshots: action.payload };
    case 'SET_RESTOCKS':
      return { ...state, restocks: action.payload };
    case 'SET_TARGETS':
      return { ...state, targets: action.payload };
    case 'SAVE_WEEK_DONE':
      return { ...state, snapshots: action.payload };
    case 'SET_TARGET':
      return { ...state, targets: [...state.targets.filter((t) => t.month !== action.payload.month), action.payload] };
    case 'SET_DISTRIBUTORS':
      return { ...state, distributors: action.payload };
    case 'ADD_RESTOCK_DONE':
      return { ...state, restocks: action.payload };
    case 'DELETE_RESTOCK_DONE':
      return { ...state, restocks: action.payload };
    default:
      return state;
  }
}

function loadLocalDistributors(): Distributor[] {
  try {
    const r = localStorage.getItem('sb_distributors_v2');
    if (r) return JSON.parse(r);
  } catch {}
  return initialDistributors;
}

const initialState: AppState = {
  products: initialProducts,
  distributors: loadLocalDistributors(),
  snapshots: [],
  restocks: [],
  targets: [],
  loaded: true,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  saveWeek: (weekStart: string, entries: { productId: string; distributorId: string; quantity: number }[]) => Promise<void>;
  saveTarget: (t: MonthlyTarget) => Promise<void>;
  deleteTarget: (month: string) => Promise<void>;
  addRestock: (r: RestockRecord) => Promise<void>;
  deleteRestock: (id: string) => Promise<void>;
} | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loadErr, setLoadErr] = useState(false);

  // Load data from Supabase on mount (with timeout)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) { setLoadErr(true); dispatch({ type: 'INIT_DATA', payload: { snapshots: [], restocks: [], targets: [] } }); }
    }, 8000);
    (async () => {
      try {
        const [snapRes, restockRes, targetRes, distRes] = await Promise.all([
          supabase.from('weekly_snapshots').select('*'),
          supabase.from('restocks').select('*'),
          supabase.from('targets').select('*'),
          supabase.from('distributors').select('*'),
        ]);
        if (!cancelled) {
          clearTimeout(timer);
          const distData = (distRes.data || []).map((r: any) => r.data);
          dispatch({ type: 'INIT_DATA', payload: {
            snapshots: (snapRes.data || []).map((r: any) => ({ weekStart: r.week_start, productId: r.product_id, distributorId: r.distributor_id, quantity: r.quantity })),
            restocks: (restockRes.data || []).map((r: any) => ({ id: r.id, date: r.date, productId: r.product_id, distributorId: r.distributor_id, quantity: r.quantity, weekStart: r.week_start })),
            targets: (targetRes.data || []).map((r: any) => ({ month: r.month, salesTarget: r.sales_target })),
          }});
          if (distData.length > 0) dispatch({ type: 'SET_DISTRIBUTORS', payload: distData });
        }
      } catch {
        if (!cancelled) { clearTimeout(timer); setLoadErr(true); dispatch({ type: 'INIT_DATA', payload: { snapshots: [], restocks: [], targets: [] } }); }
      }
    })();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Real-time subscription (only once)
  useEffect(() => {
    const channel = supabase.channel('realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_snapshots' }, async () => {
        const r = await supabase.from('weekly_snapshots').select('*');
        dispatch({ type: 'SET_SNAPSHOTS', payload: (r.data || []).map((x: any) => ({ weekStart: x.week_start, productId: x.product_id, distributorId: x.distributor_id, quantity: x.quantity })) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restocks' }, async () => {
        const r = await supabase.from('restocks').select('*');
        dispatch({ type: 'SET_RESTOCKS', payload: (r.data || []).map((x: any) => ({ id: x.id, date: x.date, productId: x.product_id, distributorId: x.distributor_id, quantity: x.quantity, weekStart: x.week_start })) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'targets' }, async () => {
        const r = await supabase.from('targets').select('*');
        dispatch({ type: 'SET_TARGETS', payload: (r.data || []).map((x: any) => ({ month: x.month, salesTarget: x.sales_target })) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const saveWeek = useCallback(async (weekStart: string, entries: { productId: string; distributorId: string; quantity: number }[]) => {
    // Optimistic update: immediately update local state
    dispatch({ type: 'SET_SNAPSHOTS', payload: state.snapshots.filter(s => s.weekStart !== weekStart).concat(
      entries.filter(e => e.quantity >= 0).map(e => ({ weekStart, productId: e.productId, distributorId: e.distributorId, quantity: e.quantity }))
    )});
    // Then sync to Supabase
    try {
      await supabase.from('weekly_snapshots').delete().eq('week_start', weekStart);
      const rows = entries.filter(e => e.quantity >= 0).map(e => ({ week_start: weekStart, product_id: e.productId, distributor_id: e.distributorId, quantity: e.quantity }));
      for (let i = 0; i < rows.length; i += 100) {
        await supabase.from('weekly_snapshots').insert(rows.slice(i, i + 100));
      }
    } catch {}
  }, [state.snapshots]);

  const saveTarget = useCallback(async (t: MonthlyTarget) => {
    await supabase.from('targets').upsert({ month: t.month, sales_target: t.salesTarget }, { onConflict: 'month' });
    dispatch({ type: 'SET_TARGET', payload: t });
  }, []);

  const deleteTarget = useCallback(async (month: string) => {
    await supabase.from('targets').delete().eq('month', month);
    dispatch({ type: 'SET_TARGETS', payload: state.targets.filter(t => t.month !== month) });
  }, [state.targets]);

  const addRestock = useCallback(async (r: RestockRecord) => {
    // Optimistic update
    dispatch({ type: 'SET_RESTOCKS', payload: [...state.restocks, r] });
    try { await supabase.from('restocks').insert({ id: r.id, date: r.date, product_id: r.productId, distributor_id: r.distributorId, quantity: r.quantity, week_start: r.weekStart }); } catch {}
  }, [state.restocks]);

  const deleteRestock = useCallback(async (id: string) => {
    dispatch({ type: 'SET_RESTOCKS', payload: state.restocks.filter(r => r.id !== id) });
    try { await supabase.from('restocks').delete().eq('id', id); } catch {}
  }, [state.restocks]);

  // Show sync status banner if there's an error (non-blocking)
  const syncBanner = loadErr ? (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-700">
      数据同步暂不可用 ·
      <button onClick={() => { setLoadErr(false); window.location.reload(); }} className="underline ml-1">重试</button>
    </div>
  ) : null;

  return <AppContext.Provider value={{ state, dispatch, saveWeek, saveTarget, deleteTarget, addRestock, deleteRestock }}>
    {syncBanner}
    {children}
  </AppContext.Provider>;
};
AppProvider.displayName = 'AppProvider';

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
