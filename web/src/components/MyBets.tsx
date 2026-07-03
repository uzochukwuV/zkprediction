'use client';

import { useState, useEffect } from 'react';
import { useWalletStore, useUserBetsStore, usePredictionsStore } from '@/lib/store';
import { formatAmount } from '@/lib/contract';
import { Wallet, CheckCircle, Clock, Trophy, Shield } from 'lucide-react';
import type { UserBet, Prediction } from '@/types';

interface MyBetsProps {
  onSelectPrediction: (id: number) => void;
  onClaimBet?: (bet: UserBet, prediction: Prediction) => void;
}

export default function MyBets({ onSelectPrediction, onClaimBet }: MyBetsProps) {
  const { isConnected } = useWalletStore();
  const { bets } = useUserBetsStore();
  const { predictions } = usePredictionsStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-dark-100 rounded-2xl border border-gray-800 p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-800 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-dark-100 rounded-2xl border border-gray-800 p-8 text-center">
        <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Bets Yet</h3>
        <p className="text-gray-400">Connect your wallet to see your bets.</p>
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="bg-dark-100 rounded-2xl border border-gray-800 p-8 text-center">
        <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Bets Yet</h3>
        <p className="text-gray-400 mb-4">You haven&apos;t placed any bets on active predictions.</p>
        <p className="text-sm text-gray-500">Browse predictions and place your first bet to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bets.map((bet) => {
        const prediction = predictions.get(Number(bet.predictionId));
        const isWinner = prediction?.status === 'Settled' && prediction.winningOption !== null && bet.choice === prediction.winningOption;

        return (
          <div
            key={String(bet.predictionId)}
            onClick={() => onSelectPrediction(Number(bet.predictionId))}
            className="bg-dark-100 rounded-xl border border-gray-800 hover:border-primary-500/50 transition-all cursor-pointer overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Prediction #{String(bet.predictionId)}</p>
                  <h4 className="text-white font-medium">{prediction?.params.question || 'Loading...'}</h4>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    prediction?.status === 'Open'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                      : prediction?.status === 'Closed'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        : prediction?.status === 'Settled'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                  }`}
                >
                  {prediction?.status || 'Unknown'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-dark-200 border border-gray-700 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Your Bet</p>
                    <p className={`text-lg font-bold ${Number(bet.choice) === 0 ? 'text-primary-400' : 'text-secondary-400'}`}>
                      {Number(bet.choice) === 0 ? prediction?.params.optionA : prediction?.params.optionB}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="text-white font-semibold">{formatAmount(BigInt(bet.amount), 7)} XLM</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1 text-gray-400">
                  {bet.committed ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>Committed</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span>Pending</span>
                    </>
                  )}
                </div>

                {bet.claimed && (
                  <div className="flex items-center space-x-1 text-green-400">
                    <Trophy className="w-4 h-4" />
                    <span>Claimed</span>
                  </div>
                )}
              </div>
            </div>

            {prediction?.status === 'Settled' && prediction.winningOption !== null && (
              <div className={`px-4 py-3 border-t border-gray-800 ${isWinner ? 'bg-purple-500/10' : 'bg-red-500/10'}`}>
                <div className={isWinner ? 'text-purple-400' : 'text-red-400'}>
                  {isWinner ? 'You voted for the correct answer' : 'Your vote did not match the settled answer'}
                </div>
                {isWinner && !bet.claimed && onClaimBet && prediction && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onClaimBet(bet, prediction);
                    }}
                    className="mt-2 inline-flex items-center space-x-2 text-purple-300 font-medium hover:text-purple-200"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Prepare claim proof</span>
                  </button>
                )}
                {bet.claimed && <span className="text-purple-400 font-medium">Claimed</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

