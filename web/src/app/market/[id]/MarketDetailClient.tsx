'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import BettingModal from '@/components/BettingModal';
import ClaimRewardModal from '@/components/ClaimRewardModal';
import { PredictionContract, formatAmount } from '@/lib/contract';
import { usePredictionsStore, useUserBetsStore, useWalletStore } from '@/lib/store';
import { Prediction, UserBet } from '@/types';
import { ArrowLeft, CircleDot, Clock3, Sparkles, Users } from 'lucide-react';

const predictionContract = new PredictionContract('testnet');

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface MarketDetailClientProps {
  marketId: string;
}

export default function MarketDetailClient({ marketId }: MarketDetailClientProps) {
  const marketIdNumber = Number(marketId);
  const { address } = useWalletStore();
  const { predictions, addPrediction } = usePredictionsStore();
  const { bets } = useUserBetsStore();

  const [prediction, setPrediction] = useState<Prediction | null>(predictions.get(marketIdNumber) ?? null);
  const [loading, setLoading] = useState(!prediction);
  const [error, setError] = useState('');
  const [showBettingModal, setShowBettingModal] = useState(false);
  const [claimPrediction, setClaimPrediction] = useState<Prediction | null>(null);
  const [claimBet, setClaimBet] = useState<UserBet | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPrediction = async () => {
      if (Number.isNaN(marketIdNumber)) {
        setError('Invalid market id');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const remotePrediction = await predictionContract.getPrediction(marketIdNumber);
        if (cancelled) return;
        setPrediction(remotePrediction);
        addPrediction(remotePrediction);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load market');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPrediction();

    return () => {
      cancelled = true;
    };
  }, [addPrediction, marketIdNumber]);

  const userBet = useMemo(() => {
    return bets.find((bet) => Number(bet.predictionId) === marketIdNumber) ?? null;
  }, [bets, marketIdNumber]);

  if (Number.isNaN(marketIdNumber)) {
    return (
      <div className="min-h-screen bg-dark-300 text-white">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="font-label text-[11px] text-secondary-500">Invalid route</p>
          <h1 className="mt-4 font-display text-4xl text-white">This route does not point to a valid market.</h1>
          <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to browse
          </Link>
        </main>
      </div>
    );
  }

  if (loading && !prediction) {
    return (
      <div className="min-h-screen bg-dark-300 text-white">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <div className="h-6 w-40 animate-pulse bg-white/5" />
            <div className="h-20 w-full animate-pulse bg-white/5" />
            <div className="h-40 w-full animate-pulse bg-white/5" />
          </div>
        </main>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="min-h-screen bg-dark-300 text-white">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-6">
            <p className="font-label text-[11px] text-secondary-500">Market not found</p>
            <h1 className="font-display text-4xl text-white">We could not load this market.</h1>
            <p className="text-silver-mist">{error || 'The market may not exist on this contract yet.'}</p>
            <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to browse
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const participantCount = prediction.countA + prediction.countB;
  const optionAPercent = participantCount > 0 ? Math.round((prediction.countA / participantCount) * 100) : 0;
  const optionBPercent = participantCount > 0 ? 100 - optionAPercent : 0;
  const winningOption = prediction.winningOption;
  const settled = prediction.status === 'Settled' && winningOption !== null;
  const eligible = settled && userBet ? Number(userBet.choice) === winningOption : false;

  const handlePrepareClaim = (bet: UserBet, market: Prediction) => {
    setClaimBet(bet);
    setClaimPrediction(market);
    setShowClaimModal(true);
  };

  return (
    <div className="min-h-screen bg-dark-300 text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-ash-gray transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to markets
          </Link>
          <span className="font-label text-[11px] text-secondary-500">Market #{prediction.id}</span>
        </div>

        <section className="grid gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-silver-mist">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <span>{prediction.status}</span>
            </div>

            <h1 className="font-display max-w-5xl text-[clamp(3rem,7vw,6.5rem)] leading-[0.92] text-white">
              {prediction.params.question}
            </h1>

            <p className="max-w-2xl text-lg leading-8 text-silver-mist sm:text-xl">
              This detail page shows the full market state, settlement outcome, and the claim path for a winner.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowBettingModal(true)}
                className="rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
              >
                Place bet
              </button>
              {settled && eligible && userBet && (
                <button
                  onClick={() => handlePrepareClaim(userBet, prediction)}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:-translate-y-0.5"
                >
                  Prepare claim
                </button>
              )}
              {prediction.status === 'Open' && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm text-silver-mist">
                  <Clock3 className="h-4 w-4 text-secondary-500" />
                  Betting open
                </span>
              )}
            </div>

            <div className="grid gap-6 border-t border-white/8 pt-8 sm:grid-cols-3">
              <div>
                <p className="font-label text-[11px] text-ash-gray">Pool</p>
                <p className="mt-2 text-4xl font-medium text-white">{formatAmount(prediction.totalPool, 7)}</p>
              </div>
              <div>
                <p className="font-label text-[11px] text-ash-gray">Participants</p>
                <p className="mt-2 text-4xl font-medium text-white">{participantCount}</p>
              </div>
              <div>
                <p className="font-label text-[11px] text-ash-gray">Deadline</p>
                <p className="mt-2 text-xl font-medium text-white">{formatDate(prediction.params.deadline)}</p>
              </div>
            </div>
          </div>

          <aside className="space-y-6 border border-white/8 bg-white/[0.02] p-8 backdrop-blur-sm">
            <div>
              <p className="font-label text-[11px] text-secondary-500">Market facts</p>
              <h2 className="mt-3 font-display text-3xl text-white">Live contract state</h2>
            </div>

            <div className="space-y-4 text-sm text-silver-mist">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span>Option A</span>
                <span className="text-white">{prediction.params.optionA}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span>Option B</span>
                <span className="text-white">{prediction.params.optionB}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span>Creator</span>
                <span className="break-all text-white">{prediction.creator}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span>Pool token</span>
                <span className="break-all text-white">{prediction.params.poolToken}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span>Reserve price</span>
                <span className="text-white">{formatAmount(prediction.params.reservePrice, 7)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span>Status</span>
                <span className="text-white">{prediction.status}</span>
              </div>
            </div>

            <div className="space-y-4 border-t border-white/8 pt-6">
              <div className="flex items-center justify-between text-sm text-silver-mist">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Option A</span>
                </span>
                <span className="text-white">{prediction.countA} votes</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-white/8">
                <div className="h-full bg-primary-500" style={{ width: `${optionAPercent}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-ash-gray">
                <span>{optionAPercent}%</span>
                <span>{prediction.countB} votes on B</span>
              </div>

              <div className="flex items-center justify-between pt-4 text-sm text-silver-mist">
                <span className="inline-flex items-center gap-2">
                  <CircleDot className="h-4 w-4" />
                  <span>Option B</span>
                </span>
                <span className="text-white">{prediction.countB} votes</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-white/8">
                <div className="h-full bg-secondary-500" style={{ width: `${optionBPercent}%` }} />
              </div>
            </div>

            <div className="border-t border-white/8 pt-6 text-sm text-silver-mist">
              <div className="flex items-center justify-between">
                <span>Winning option</span>
                <span className="text-white">{winningOption === null ? 'Pending' : winningOption === 0 ? 'A' : 'B'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span>On-chain result</span>
                <span className="text-white">{settled ? 'Settled' : 'Awaiting settlement'}</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-16 border-t border-white/8 pt-10">
          <div className="max-w-3xl space-y-3">
            <p className="font-label text-[11px] text-secondary-500">Your position</p>
            <h2 className="font-display text-3xl text-white sm:text-5xl">Claimability is computed from your stored commitment.</h2>
            <p className="text-silver-mist">
              {userBet ? 'We found a local bet for this market. Open the claim flow to generate proof inputs.' : 'No local bet found for this market yet.'}
            </p>
          </div>

          <div className="mt-8 max-w-2xl">
            {userBet ? (
              <div className="space-y-4 border border-white/8 bg-white/[0.02] p-6">
                <div className="flex items-center justify-between text-sm text-silver-mist">
                  <span>Choice</span>
                  <span className="text-white">{Number(userBet.choice) === 0 ? prediction.params.optionA : prediction.params.optionB}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-silver-mist">
                  <span>Amount</span>
                  <span className="text-white">{formatAmount(BigInt(userBet.amount), 7)} XLM</span>
                </div>
                <div className="flex items-center justify-between text-sm text-silver-mist">
                  <span>Claim state</span>
                  <span className={eligible ? 'text-violet-300' : 'text-amber-300'}>{eligible ? 'Eligible' : 'Not eligible'}</span>
                </div>
                {settled && eligible && (
                  <button
                    onClick={() => handlePrepareClaim(userBet, prediction)}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:-translate-y-0.5"
                  >
                    Build claim proof
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-white/8 bg-white/[0.02] p-6 text-silver-mist">
                Connect your wallet and place a bet on this market to see claim data here.
              </div>
            )}
          </div>
        </section>
      </main>

      {prediction && (
        <BettingModal
          prediction={prediction}
          isOpen={showBettingModal}
          onClose={() => setShowBettingModal(false)}
          onBet={async (choice, amount, commitment) => {
            const bettor = useWalletStore.getState().address;
            if (!bettor) throw new Error('Connect a wallet first.');
            const slot = await predictionContract.commitBet(bettor, prediction.id, amount, commitment, amount);
            const updated = await predictionContract.getPrediction(prediction.id);
            addPrediction(updated);
            return slot;
          }}
        />
      )}

      {claimPrediction && claimBet && (
        <ClaimRewardModal
          prediction={claimPrediction}
          bet={claimBet}
          isOpen={showClaimModal}
          onClose={() => {
            setShowClaimModal(false);
            setClaimBet(null);
            setClaimPrediction(null);
          }}
          onMarkClaimed={() => {
            setShowClaimModal(false);
            setClaimBet(null);
            setClaimPrediction(null);
          }}
        />
      )}
    </div>
  );
}