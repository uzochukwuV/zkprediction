// Global state management with Zustand

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { 
  Prediction, 
  UserBet, 
  WalletState, 
  TransactionState,
  ContractConfig 
} from '@/types';

// Wallet store
interface WalletStore extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  setAddress: (address: string | null) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  
  connect: async () => {
    set({ isConnecting: true, error: null });
    try {
      // Import dynamically to avoid SSR issues
      const { connectFreighter } = await import('./wallet');
      const address = await connectFreighter();
      if (address) {
        set({ address, isConnected: true, isConnecting: false });
      } else {
        set({ isConnecting: false, error: 'Failed to connect wallet' });
      }
    } catch (error) {
      set({ 
        isConnecting: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      });
    }
  },
  
  disconnect: () => {
    set({ 
      address: null, 
      isConnected: false, 
      isConnecting: false,
      error: null 
    });
  },
  
  setAddress: (address) => set({ address }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setError: (error) => set({ error }),
}));

// Contract config store
interface ConfigStore {
  config: ContractConfig;
  setConfig: (config: Partial<ContractConfig>) => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      config: {
        // Deployed ZK prediction contract on testnet
        contractId: 'CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7',
        // SAC Token for testnet
        tokenId: 'CASJ2W5ODS6CXA34RXSXEE4A743NMNQHTPBCFINJXCVNV75VJJNFZZRV',
        network: 'testnet',
        rpcUrl: 'https://soroban-testnet.stellar.org:443',
      },
      setConfig: (newConfig) => 
        set((state) => ({ config: { ...state.config, ...newConfig } })),
    }),
    { name: 'zkprediction-config' }
  )
);

// Predictions store
interface PredictionsStore {
  predictions: Map<number, Prediction>;
  loading: boolean;
  error: string | null;
  
  addPrediction: (prediction: Prediction) => void;
  updatePrediction: (id: number, updates: Partial<Prediction>) => void;
  removePrediction: (id: number) => void;
  setPredictions: (predictions: Prediction[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePredictionsStore = create<PredictionsStore>((set) => ({
  predictions: new Map(),
  loading: false,
  error: null,
  
  addPrediction: (prediction) =>
    set((state) => {
      const newPredictions = new Map(state.predictions);
      newPredictions.set(prediction.id, prediction);
      return { predictions: newPredictions };
    }),
    
  updatePrediction: (id, updates) =>
    set((state) => {
      const newPredictions = new Map(state.predictions);
      const existing = newPredictions.get(id);
      if (existing) {
        newPredictions.set(id, { ...existing, ...updates });
      }
      return { predictions: newPredictions };
    }),
    
  removePrediction: (id) =>
    set((state) => {
      const newPredictions = new Map(state.predictions);
      newPredictions.delete(id);
      return { predictions: newPredictions };
    }),
    
  setPredictions: (predictions) =>
    set(() => {
      const map = new Map<number, Prediction>();
      predictions.forEach((p) => map.set(p.id, p));
      return { predictions: map };
    }),
    
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

// User bets store (local storage persistence)
interface UserBetsStore {
  bets: UserBet[];
  addBet: (bet: UserBet) => void;
  updateBet: (predictionId: number, updates: Partial<UserBet>) => void;
  getBetByPrediction: (predictionId: number) => UserBet | undefined;
  clearBets: () => void;
}

export const useUserBetsStore = create<UserBetsStore>()(
  persist(
    (set, get) => ({
      bets: [],
      
      addBet: (bet) => set((state) => ({ bets: [...state.bets, bet] })),
      
      updateBet: (predictionId, updates) =>
        set((state) => ({
          bets: state.bets.map((b) =>
            b.predictionId === predictionId ? { ...b, ...updates } : b
          ),
        })),
        
      getBetByPrediction: (predictionId) =>
        get().bets.find((b) => b.predictionId === predictionId),
        
      clearBets: () => set({ bets: [] }),
    }),
    {
      name: 'zkprediction-bets',
      storage: createJSONStorage(() => localStorage, {
        replacer: (_, value) => (typeof value === 'bigint' ? value.toString() : value),
        reviver: (_, value) => {
          if (value && typeof value === 'object' && 'bets' in value && Array.isArray(value.bets)) {
            return {
              ...value,
              bets: value.bets.map((bet: any) => ({
                ...bet,
                predictionId: typeof bet.predictionId === 'string' && /^-?\\d+$/.test(bet.predictionId) ? Number(bet.predictionId) : bet.predictionId,
                choice: typeof bet.choice === 'string' && /^-?\\d+$/.test(bet.choice) ? Number(bet.choice) : bet.choice,
                amount: typeof bet.amount === 'string' && /^-?\\d+$/.test(bet.amount) ? BigInt(bet.amount) : bet.amount,
                slot: typeof bet.slot === 'string' && /^-?\\d+$/.test(bet.slot) ? Number(bet.slot) : bet.slot,
              })),
            };
          }

          return value;
        },
      }),
    }
  )
);

// Transaction store
interface TransactionStore extends TransactionState {
  setPending: (pending: boolean) => void;
  setHash: (hash: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  pending: false,
  hash: null,
  error: null,
  
  setPending: (pending) => set({ pending }),
  setHash: (hash) => set({ hash }),
  setError: (error) => set({ error }),
  reset: () => set({ pending: false, hash: null, error: null }),
}));

// UI state store
interface UIStore {
  activeTab: 'browse' | 'create' | 'my-bets' | 'history';
  setActiveTab: (tab: UIStore['activeTab']) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  modalOpen: string | null;
  openModal: (modal: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: 'browse',
  setActiveTab: (activeTab) => set({ activeTab }),
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  modalOpen: null,
  openModal: (modalOpen) => set({ modalOpen }),
  closeModal: () => set({ modalOpen: null }),
}));

