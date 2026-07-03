'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PredictionCard from '@/components/PredictionCard';
import CreatePredictionForm from '@/components/CreatePredictionForm';
import MyBets from '@/components/MyBets';
import { usePredictionsStore, useUIStore, useWalletStore } from '@/lib/store';
import { Prediction } from '@/types';
import { PredictionContract, formatAmount } from '@/lib/contract';
import { ArrowRight, ChevronRight, Compass, Plus, Sparkles, TrendingUp } from 'lucide-react';

const predictionContract = new PredictionContract('testnet');
const DEFAULT_POOL_TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

function AmbientTriangle({ className }: { className: string }) {
  return <div className={`absolute ambient-triangle ${className}`} />;
}

export default function Home() {
  const router = useRouter();
  const { predictions, setPredictions } = usePredictionsStore();
  const { activeTab, setActiveTab } = useUIStore();
  const { address } = useWalletStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPredictions = async () => {
      setLoading(true);
      try {
        const remotePredictions = await predictionContract.listPredictions();
        if (!cancelled) {
          setPredictions(remotePredictions);
        }
      } catch (error) {
        console.error('Failed to load predictions from chain:', error);
        if (!cancelled) {
          setPredictions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPredictions();

    return () => {
      cancelled = true;
    };
  }, [setPredictions]);

  const allPredictions = useMemo(() => Array.from(predictions.values()), [predictions]);
  const featuredPrediction = allPredictions[0] ?? null;

  const filteredPredictions = useMemo(() => {
    return allPredictions.filter((prediction) => {
      const matchesSearch = prediction.params.question.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || prediction.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [allPredictions, searchQuery, filterStatus]);

  const stats = {
    totalPredictions: allPredictions.length,
    openPredictions: allPredictions.filter((prediction) => prediction.status === 'Open').length,
    totalPool: allPredictions.reduce((sum, prediction) => sum + Number(prediction.totalPool), 0),
  };

  const handleCreatePrediction = async (input: any) => {
    const creator = useWalletStore.getState().address;
    if (!creator) throw new Error('Connect a wallet first.');

    const predictionId = await predictionContract.createPrediction(
      creator,
      input.question,
      input.optionA,
      input.optionB,
      input.deadline,
      input.reservePrice,
      DEFAULT_POOL_TOKEN
    );

    const createdPrediction = await predictionContract.getPrediction(predictionId);
    usePredictionsStore.getState().addPrediction(createdPrediction);
    setActiveTab('browse');
    router.push(`/market/${predictionId}`);
  };

  const handleSelectPrediction = (id: number) => {
    router.push(`/market/${id}`);
  };

  return (
    <div className="min-h-screen bg-dark-300 text-white">
      <Header />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 void-grid opacity-[0.16]" />
          <AmbientTriangle className="left-[8%] top-[18%] h-2 w-2 bg-primary-500/70" />
          <AmbientTriangle className="left-[22%] top-[12%] h-3 w-3 bg-secondary-500/60" />
          <AmbientTriangle className="left-[12%] bottom-[18%] h-2 w-2 bg-white/70" />
          <AmbientTriangle className="right-[15%] top-[18%] h-3 w-3 bg-primary-500/50" />
          <AmbientTriangle className="right-[8%] bottom-[14%] h-2 w-2 bg-secondary-500/60" />

          <div className="mx-auto grid max-w-7xl gap-16 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:px-8 lg:py-24">
            <div className="max-w-4xl space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-silver-mist">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <span>Outcome based prediction market</span>
              </div>

              <div className="space-y-6">
                <h1 className="font-display max-w-4xl text-[clamp(3.5rem,8vw,7.2rem)] leading-[0.9] text-white">
                  Private bets.
                  <br />
                  Public outcomes.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-silver-mist sm:text-xl">
                  Commit to an answer without revealing it. Settlement publishes the result, and winners prove their commitment privately with a circuit proof.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="#markets"
                  className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                >
                  Browse markets
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setActiveTab('create')}
                  className="font-label text-sm text-ash-gray transition-colors hover:text-white"
                >
                  Create a market
                </button>
                <span className="font-label text-sm text-ash-gray">
                  {address ? 'Wallet connected' : 'Connect wallet to create or bet'}
                </span>
              </div>

              <div className="grid gap-4 pt-6 sm:grid-cols-3">
                <div>
                  <p className="font-label text-[11px] text-ash-gray">Markets</p>
                  <p className="mt-2 text-4xl font-medium text-white">{stats.totalPredictions}</p>
                </div>
                <div>
                  <p className="font-label text-[11px] text-ash-gray">Open</p>
                  <p className="mt-2 text-4xl font-medium text-white">{stats.openPredictions}</p>
                </div>
                <div>
                  <p className="font-label text-[11px] text-ash-gray">Pool</p>
                  <p className="mt-2 text-4xl font-medium text-white">{(stats.totalPool / 1000000).toFixed(0)}M</p>
                </div>
              </div>
            </div>

            <aside className="relative flex min-h-[420px] items-end justify-end">
              <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-primary-500/12 blur-3xl" />
              <div className="relative w-full max-w-md space-y-6 border border-white/8 bg-white/[0.02] p-8 backdrop-blur-sm">
                <p className="font-label text-[11px] text-secondary-500">Featured market</p>
                {featuredPrediction ? (
                  <>
                    <h2 className="font-display text-3xl leading-tight text-white">
                      {featuredPrediction.params.question}
                    </h2>
                    <div className="space-y-3 text-sm text-silver-mist">
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <span className="text-white">{featuredPrediction.status}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Pool</span>
                        <span className="text-white">{formatAmount(featuredPrediction.totalPool, 7)} XLM</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Split</span>
                        <span className="text-white">{featuredPrediction.countA}:{featuredPrediction.countB}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Deadline</span>
                        <span className="text-white">{new Date(featuredPrediction.params.deadline * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectPrediction(featuredPrediction.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
                    >
                      Open market
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="h-10 w-32 animate-pulse rounded-full bg-white/5" />
                    <div className="h-24 animate-pulse bg-white/5" />
                    <div className="h-4 animate-pulse bg-white/5" />
                    <div className="h-10 w-40 animate-pulse rounded-full bg-white/5" />
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>

        <section id="markets" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 border-t border-white/8 pt-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="font-label text-[11px] text-secondary-500">Live markets</p>
              <h2 className="font-display text-3xl text-white sm:text-5xl">Browse the chain directly.</h2>
              <p className="max-w-xl text-silver-mist">
                Markets are pulled from the contract, normalized into the interface shape, and rendered without mocks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-silver-mist">
                <Compass className="h-4 w-4 text-primary-500" />
                Testnet active
              </div>
              <button
                onClick={() => setActiveTab('browse')}
                className="font-label text-sm text-ash-gray transition-colors hover:text-white"
              >
                Refresh view
              </button>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search markets"
                className="w-full border-0 border-b border-white/10 bg-transparent px-0 py-3 text-white placeholder:text-ash-gray focus:outline-none focus:ring-0"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border-0 border-b border-white/10 bg-transparent px-0 py-3 text-sm text-white focus:outline-none focus:ring-0"
            >
              <option value="all" className="bg-black">All Status</option>
              <option value="Open" className="bg-black">Open</option>
              <option value="Closed" className="bg-black">Closed</option>
              <option value="Settled" className="bg-black">Settled</option>
            </select>
          </div>

          <div className="mt-10">
            {loading ? (
              <div className="space-y-6">
                <div className="h-28 animate-pulse border-b border-white/8 bg-white/[0.03]" />
                <div className="h-28 animate-pulse border-b border-white/8 bg-white/[0.03]" />
                <div className="h-28 animate-pulse border-b border-white/8 bg-white/[0.03]" />
              </div>
            ) : filteredPredictions.length === 0 ? (
              <div className="py-20 text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-white/20" />
                <h3 className="mt-5 font-display text-3xl text-white">No markets found</h3>
                <p className="mt-3 text-silver-mist">Try a different search or create a new market.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {filteredPredictions.map((prediction) => (
                  <PredictionCard key={prediction.id} prediction={prediction} onSelect={handleSelectPrediction} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="create" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="border-t border-white/8 pt-8">
            <div className="max-w-2xl space-y-3">
              <p className="font-label text-[11px] text-secondary-500">Create market</p>
              <h2 className="font-display text-3xl text-white sm:text-5xl">Introduce a new question.</h2>
              <p className="text-silver-mist">Keep the prompt precise. The cleaner the market, the cleaner the settlement path.</p>
            </div>
            <div className="mt-10 max-w-2xl">
              <CreatePredictionForm onSubmit={handleCreatePrediction} />
            </div>
          </div>
        </section>

        <section id="my-bets" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="border-t border-white/8 pt-8">
            <div className="max-w-2xl space-y-3">
              <p className="font-label text-[11px] text-secondary-500">My bets</p>
              <h2 className="font-display text-3xl text-white sm:text-5xl">Track your commitments.</h2>
              <p className="text-silver-mist">Open a market from here to inspect the claim path and settlement result.</p>
            </div>
            <div className="mt-10 max-w-4xl">
              <MyBets onSelectPrediction={handleSelectPrediction} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
