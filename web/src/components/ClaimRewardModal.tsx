'use client';

import { useEffect, useState } from 'react';
import { X, Copy, CheckCircle, AlertCircle, Shield, FileText } from 'lucide-react';
import { Prediction, UserBet } from '@/types';
import { buildClaimProofInputs, formatClaimProverToml } from '@/lib/commitment';
import { PredictionContract } from '@/lib/contract';
import { useUserBetsStore } from '@/lib/store';

interface ClaimRewardModalProps {
  prediction: Prediction;
  bet: UserBet;
  isOpen: boolean;
  onClose: () => void;
  onMarkClaimed: (predictionId: number) => void;
}

const predictionContract = new PredictionContract('testnet');

export default function ClaimRewardModal({ prediction, bet, isOpen, onClose, onMarkClaimed }: ClaimRewardModalProps) {
  const { updateBet } = useUserBetsStore();
  const [proofInputs, setProofInputs] = useState<string>('');
  const [publicInputs, setPublicInputs] = useState('');
  const [commitment, setCommitment] = useState('');
  const [copied, setCopied] = useState(false);
  const [proofHex, setProofHex] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const winningOption = prediction.winningOption;
  const eligible = winningOption !== null && bet.choice === winningOption;

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      if (!isOpen || winningOption === null) return;
      try {
        const inputs = await buildClaimProofInputs(
          prediction.id,
          Number(bet.slot),
          Number(bet.choice),
          bet.blindingFactor,
          winningOption
        );

        if (cancelled) return;

        setCommitment(inputs.commitment);
        setProofInputs(formatClaimProverToml(inputs));
        setPublicInputs(
          [
            `prediction_id = ${inputs.predictionId}`,
            `slot = ${inputs.slot}`,
            `commitment = ${inputs.commitment}`,
            `winning_option = ${inputs.winningOption}`,
          ].join('\n')
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to prepare claim inputs');
        }
      }
    };

    prepare();

    return () => {
      cancelled = true;
    };
  }, [bet.blindingFactor, bet.choice, bet.slot, isOpen, prediction.id, winningOption]);

  useEffect(() => {
    if (!isOpen) {
      setProofInputs('');
      setPublicInputs('');
      setCommitment('');
      setCopied(false);
      setProofHex('');
      setClaiming(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(proofInputs);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClaim = async () => {
    if (!proofHex) {
      setError('Paste the proof bytes first.');
      return;
    }

    setClaiming(true);
    setError('');

    try {
      await predictionContract.claimReward(prediction.id, Number(bet.slot), proofHex);
      updateBet(prediction.id, { claimed: true });
      onMarkClaimed(prediction.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-dark-100 rounded-2xl border border-gray-700 w-full max-w-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Claim Reward</h2>
            <p className="text-sm text-gray-400 mt-1">Prepare the exact witness data your proof script expects.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-xl bg-dark-200 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Prediction</p>
              <p className="text-white font-medium">{prediction.params.question}</p>
              <p className="text-xs text-gray-500 mt-2">Slot {bet.slot} | Prediction #{prediction.id}</p>
            </div>
            <div className="p-4 rounded-xl bg-dark-200 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Settlement</p>
              {winningOption === null ? (
                <p className="text-yellow-400">Waiting for settlement</p>
              ) : (
                <>
                  <p className="text-white font-medium">Winning option: {winningOption === 0 ? prediction.params.optionA : prediction.params.optionB}</p>
                  <p className={eligible ? 'text-green-400 text-sm mt-2' : 'text-red-400 text-sm mt-2'}>
                    {eligible ? 'Your bet is eligible to claim.' : 'Your bet does not match the settled answer.'}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-purple-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-300">Claim witness</p>
                <p className="text-xs text-gray-400 mt-1">
                  The proof ties your stored commitment to the admin-revealed answer. Vote stays hidden outside the proof.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-xl bg-dark-200 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-400">Prover.toml witness</p>
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all bg-black/20 rounded-lg p-3 overflow-x-auto max-h-64">{proofInputs || 'Preparing...'}</pre>
            </div>

            <div className="p-4 rounded-xl bg-dark-200 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-400">Public inputs</p>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center space-x-1 text-xs px-3 py-1 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all bg-black/20 rounded-lg p-3 overflow-x-auto max-h-64">{publicInputs || 'Preparing...'}</pre>
              <p className="text-xs text-gray-500 mt-3">
                Use this output to generate the Noir witness locally, then paste the resulting proof bytes here.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-gray-400">Proof bytes</label>
            <textarea
              value={proofHex}
              onChange={(e) => setProofHex(e.target.value)}
              placeholder="0x..."
              className="w-full h-28 px-4 py-3 rounded-xl bg-dark-200 border border-gray-700 text-white text-sm font-mono focus:border-primary-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500">Paste the hex proof produced by `bb prove` here.</p>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Commitment: {commitment || 'pending'}</span>
            <span>Nonce stays local in the user wallet or app storage</span>
          </div>

          <div className="flex space-x-4">
            <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors">
              Close
            </button>
            <button
              onClick={handleClaim}
              disabled={!eligible || claiming}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium hover:from-primary-500 hover:to-secondary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claiming ? 'Claiming...' : 'Claim on-chain'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


