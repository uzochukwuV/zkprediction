'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Loader2, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { useWalletStore } from '@/lib/store';
import { Prediction } from '@/types';
import { formatAmount, parseAmount } from '@/lib/contract';
import { generateBlindingFactor, hashCommitment, calculatePayout } from '@/lib/commitment';
import { useUserBetsStore } from '@/lib/store';

interface BettingModalProps {
  prediction: Prediction;
  isOpen: boolean;
  onClose: () => void;
  onBet: (choice: number, amount: bigint, commitment: string, nonce: string) => Promise<number>;
}

export default function BettingModal({ prediction, isOpen, onClose, onBet }: BettingModalProps) {
  const { isConnected, address } = useWalletStore();
  const { addBet } = useUserBetsStore();

  const [step, setStep] = useState<'select' | 'confirm' | 'processing' | 'success' | 'error'>('select');
  const [choice, setChoice] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [nonce, setNonce] = useState('');
  const [commitment, setCommitment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setChoice(null);
      setAmount('');
      setShowPreview(false);
      setNonce('');
      setCommitment('');
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !nonce) {
      setNonce(generateBlindingFactor());
    }
  }, [isOpen, nonce]);

  useEffect(() => {
    let cancelled = false;

    const computeCommitment = async () => {
      if (choice === null || !nonce) return;
      try {
        const nextCommitment = await hashCommitment(choice, nonce);
        if (!cancelled) {
          setCommitment(nextCommitment);
        }
      } catch (e) {
        console.error('Failed to compute commitment:', e);
      }
    };

    computeCommitment();

    return () => {
      cancelled = true;
    };
  }, [choice, nonce]);

  const handleSelectOption = (selected: number) => {
    setChoice(selected);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!address || choice === null || !amount || !commitment || !nonce) {
      setError('Missing required fields');
      return;
    }

    setStep('processing');
    setError('');

    try {
      const amountBigInt = parseAmount(amount);
      const slot = await onBet(choice, amountBigInt, commitment, nonce);

      console.log(slot)

      console.log(prediction, choice, amountBigInt, nonce, slot)
      
      addBet({
        predictionId: prediction.id,
        choice,
        amount: BigInt(amountBigInt),
        blindingFactor: nonce,
        slot,
        committed: true,
        claimed: false,
      }); 

      console.log("jbdkjasbd baksnjda")
      setStep('success');
    } catch (e) {
      console.log(e)
      setError(e instanceof Error ? e.message : 'Transaction failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    if (step !== 'processing') {
      onClose();
    }
  };

  const amountBigInt = amount ? parseAmount(amount) : 0n;
  const estimatedPayout = () => {
    if (!amount || choice === null) return null;
    const totalPool = prediction.totalPool + amountBigInt;
    const winningCount = choice === 0 ? BigInt(prediction.countA + 1) : BigInt(prediction.countB + 1);
    return calculatePayout(totalPool, winningCount, amountBigInt);
  };

  const multiplier = estimatedPayout() && amountBigInt > 0n ? Number(estimatedPayout()!) / Number(amountBigInt) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-dark-100 rounded-2xl border border-gray-700 w-full max-w-lg overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Place Your Bet</h2>
            {step !== 'processing' && (
              <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
          <p className="text-gray-400 mt-1 text-sm">{prediction.params.question}</p>
        </div>

        <div className="p-6">
          {step === 'select' && (
            <>
              {!isConnected ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Wallet Not Connected</h3>
                  <p className="text-gray-400">Please connect your wallet to place a bet.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-400 mb-4">Select your prediction. The winning side is the admin-revealed outcome.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleSelectOption(0)}
                      className="p-6 rounded-xl border-2 border-gray-700 hover:border-primary-500 bg-gray-800/50 hover:bg-primary-500/10 transition-all group"
                    >
                      <p className="text-sm text-gray-400 mb-2">Option A</p>
                      <p className="text-lg font-bold text-white mb-4 group-hover:text-primary-400">{prediction.params.optionA}</p>
                      <div className="text-xs text-gray-500">
                        <p>{prediction.countA} currently betting</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSelectOption(1)}
                      className="p-6 rounded-xl border-2 border-gray-700 hover:border-secondary-500 bg-gray-800/50 hover:bg-secondary-500/10 transition-all group"
                    >
                      <p className="text-sm text-gray-400 mb-2">Option B</p>
                      <p className="text-lg font-bold text-white mb-4 group-hover:text-secondary-400">{prediction.params.optionB}</p>
                      <div className="text-xs text-gray-500">
                        <p>{prediction.countB} currently betting</p>
                      </div>
                    </button>
                  </div>

                  <div className="mt-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                    <div className="flex items-start space-x-3">
                      <Shield className="w-5 h-5 text-purple-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-300">How does outcome-based claiming work?</p>
                        <p className="text-xs text-gray-400 mt-1">
                          After settlement, the admin posts the winning answer and counts. Winners claim by proving they committed to the correct answer.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">You selected</p>
                <div className={`p-4 rounded-xl border-2 ${choice === 0 ? 'border-primary-500 bg-primary-500/10' : 'border-secondary-500 bg-secondary-500/10'}`}>
                  <p className="text-lg font-bold text-white">{choice === 0 ? prediction.params.optionA : prediction.params.optionB}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Bet Amount (XLM)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 rounded-xl bg-dark-200 border border-gray-700 text-white text-lg focus:border-primary-500 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">XLM</span>
                </div>
                {prediction.params.reservePrice > 0n && (
                  <p className="text-xs text-gray-500 mt-1">Minimum: {formatAmount(prediction.params.reservePrice, 7)} XLM</p>
                )}
              </div>

              {amount && parseAmount(amount) >= prediction.params.reservePrice && (
                <div className="mb-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Potential Payout</span>
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-xs text-gray-500 hover:text-white flex items-center space-x-1"
                    >
                      {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPreview ? 'Hide' : 'Show'} math</span>
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-purple-400">{formatAmount(estimatedPayout() || 0n, 7)} XLM</p>
                  <p className="text-sm text-green-400 mt-1">Outcome-based claim</p>

                  {showPreview && (
                    <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
                      <p>• Your bet: {formatAmount(parseAmount(amount), 7)} XLM</p>
                      <p>• Claim requires proving this commitment matches the winning answer</p>
                      <p>• Admin settlement only posts the outcome and total counts</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6 p-4 rounded-xl bg-dark-200 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Your Commitment Hash</span>
                  <Lock className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-xs text-gray-500 font-mono break-all">{commitment || 'Computing...'}</p>
                <p className="text-xs text-gray-600 mt-2">Your answer stays hidden until claim time. This hash proves you committed to a specific answer.</p>
              </div>

              <div className="flex space-x-4">
                <button onClick={() => setStep('select')} className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors">
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!amount || parseAmount(amount) < prediction.params.reservePrice}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium hover:from-primary-500 hover:to-secondary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Bet
                </button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-white mb-2">Processing Transaction</h3>
              <p className="text-gray-400 text-sm">Please confirm in your wallet...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Bet Placed!</h3>
              <p className="text-gray-400 mb-6">Your bet has been committed. Your answer is now hidden until claim time.</p>
              <div className="p-4 rounded-xl bg-dark-200 border border-gray-700 mb-6">
                <p className="text-sm text-gray-400 mb-1">Your Commitment</p>
                <p className="text-xs font-mono text-green-400 break-all">{commitment}</p>
              </div>
              <button onClick={onClose} className="w-full px-4 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-500 transition-colors">
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Transaction Failed</h3>
              <p className="text-gray-400 mb-6">{error}</p>
              <button onClick={() => setStep('confirm')} className="w-full px-4 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}