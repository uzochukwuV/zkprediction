'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import PredictionCard from '@/components/PredictionCard';
import BettingModal from '@/components/BettingModal';
import CreatePredictionForm from '@/components/CreatePredictionForm';
import MyBets from '@/components/MyBets';
import { useWalletStore, usePredictionsStore, useUIStore } from '@/lib/store';
import { Prediction } from '@/types';
import { formatAmount } from '@/lib/contract';
import { hashCommitment } from '@/lib/commitment';
import { TrendingUp, Plus, History, Wallet, Search, Filter, Loader2, AlertCircle, Sparkles } from 'lucide-react';

// Mock data for demo
const mockPredictions: Prediction[] = [
  {
    id: 1,
    params: {
      question: 'Will Bitcoin exceed $100,000 by December 31, 2025?',
      optionA: 'Yes',
      optionB: 'No',
      deadline: Math.floor(Date.now() / 1000) + 86400 * 7,
      reservePrice: BigInt(10000000),
      poolToken: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    },
    status: 'Open',
    betCount: 156,
    totalPool: BigInt(15600000000),
    countA: 112,
    countB: 44,
    winningOption: null,
    minorityOption: null,
    minorityCount: null,
    minorityTotal: null,
    creator: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  },
  {
    id: 2,
    params: {
      question: 'Will Ethereum flip Bitcoin market cap by 2026?',
      optionA: 'Yes',
      optionB: 'No',
      deadline: Math.floor(Date.now() / 1000) + 86400 * 30,
      reservePrice: BigInt(0),
      poolToken: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    },
    status: 'Open',
    betCount: 89,
    totalPool: BigInt(8900000000),
    countA: 23,
    countB: 66,
    winningOption: null,
    minorityOption: null,
    minorityCount: null,
    minorityTotal: null,
    creator: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  },
  {
    id: 3,
    params: {
      question: 'Will SpaceX land humans on Mars before 2030?',
      optionA: 'Yes',
      optionB: 'No',
      deadline: Math.floor(Date.now() / 1000) - 3600,
      reservePrice: BigInt(5000000),
      poolToken: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    },
    status: 'Resolved',
    betCount: 234,
    totalPool: BigInt(23400000000),
    countA: 198,
    countB: 36,
    winningOption: 1,
    minorityOption: 1,
    minorityCount: 36,
    minorityTotal: BigInt(3600000000),
    creator: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  },
];

export default function Home() {
  const { address, isConnected } = useWalletStore();
  const { predictions, setPredictions, addPrediction } = usePredictionsStore();
  const { activeTab, setActiveTab } = useUIStore();
  
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [showBettingModal, setShowBettingModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Initialize with mock data
  useEffect(() => {
    setMounted(true);
    // In production, fetch from contract
    setPredictions(mockPredictions);
    setLoading(false);
  }, [setPredictions]);
  
  const handleSelectPrediction = (id: number) => {
    const prediction = predictions.get(id);
    if (prediction) {
      setSelectedPrediction(prediction);
      setShowBettingModal(true);
    }
  };
  
  const handleCreatePrediction = async (input: any) => {
    // In production, call contract
    console.log('Creating prediction:', input);
    // Simulate contract call
    await new Promise(resolve => setTimeout(resolve, 2000));
  };
  
  const handlePlaceBet = async (choice: number, amount: bigint, commitment: string, blindingFactor: string) => {
    // In production, call contract
    console.log('Placing bet:', { choice, amount, commitment, blindingFactor });
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 2000));
  };
  
  // Filter predictions
  const filteredPredictions = Array.from(predictions.values()).filter(p => {
    const matchesSearch = p.params.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });
  
  const stats = {
    totalPredictions: predictions.size,
    totalPool: Array.from(predictions.values()).reduce((sum, p) => sum + Number(p.totalPool), 0),
    openPredictions: Array.from(predictions.values()).filter(p => p.status === 'Open').length,
  };
  
  return (
    <div className="min-h-screen bg-dark-300">
      <Header />
      
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Private Betting • ZK Verified • On Stellar</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              <span className="gradient-text">Minority Wins</span>
              <br />
              Prediction Market
            </h1>
            
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Bet on outcomes privately. When the MINORITY wins, they take the entire pool.
              Contrarian thinking is rewarded.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="bg-dark-100/50 rounded-xl p-4 border border-gray-800">
                <p className="text-3xl font-bold text-white">{stats.totalPredictions}</p>
                <p className="text-sm text-gray-400">Active Markets</p>
              </div>
              <div className="bg-dark-100/50 rounded-xl p-4 border border-gray-800">
                <p className="text-3xl font-bold text-purple-400">
                  {(stats.totalPool / 1000000).toFixed(0)}M
                </p>
                <p className="text-sm text-gray-400">Total XLM</p>
              </div>
              <div className="bg-dark-100/50 rounded-xl p-4 border border-gray-800">
                <p className="text-3xl font-bold text-green-400">{stats.openPredictions}</p>
                <p className="text-sm text-gray-400">Open for Betting</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-1 bg-dark-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'browse'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />
              Browse
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'create'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create
            </button>
            <button
              onClick={() => setActiveTab('my-bets')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'my-bets'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4 inline mr-2" />
              My Bets
            </button>
          </div>
          
          {/* Filters */}
          {activeTab === 'browse' && (
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search predictions..."
                  className="pl-10 pr-4 py-2 rounded-lg bg-dark-100 border border-gray-700 text-white text-sm focus:border-primary-500 focus:outline-none w-64"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 rounded-lg bg-dark-100 border border-gray-700 text-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Resolved">Resolved</option>
                <option value="Settled">Settled</option>
              </select>
            </div>
          )}
        </div>
        
        {/* Tab Content */}
        {activeTab === 'browse' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
            ) : filteredPredictions.length === 0 ? (
              <div className="text-center py-20">
                <TrendingUp className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Predictions Found</h3>
                <p className="text-gray-400">
                  {searchQuery ? 'Try a different search term' : 'Be the first to create a prediction!'}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPredictions.map((prediction) => (
                  <PredictionCard
                    key={prediction.id}
                    prediction={prediction}
                    onSelect={handleSelectPrediction}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto">
            <CreatePredictionForm onSubmit={handleCreatePrediction} />
          </div>
        )}
        
        {activeTab === 'my-bets' && (
          <div className="max-w-3xl mx-auto">
            <MyBets onSelectPrediction={handleSelectPrediction} />
          </div>
        )}
      </section>
      
      {/* Betting Modal */}
      {selectedPrediction && (
        <BettingModal
          prediction={selectedPrediction}
          isOpen={showBettingModal}
          onClose={() => {
            setShowBettingModal(false);
            setSelectedPrediction(null);
          }}
          onBet={handlePlaceBet}
        />
      )}
      
      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              <span className="font-semibold text-white">zkPrediction</span> • Built on Stellar Soroban
            </div>
            <div className="flex items-center space-x-4">
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
