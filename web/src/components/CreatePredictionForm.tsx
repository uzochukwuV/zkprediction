'use client';

import { useState } from 'react';
import { useWalletStore } from '@/lib/store';
import { CreatePredictionInput } from '@/types';
import { Plus, Loader2, AlertCircle, CheckCircle, Calendar, Clock, HelpCircle } from 'lucide-react';

interface CreatePredictionFormProps {
  onSubmit: (input: CreatePredictionInput) => Promise<void>;
}

export default function CreatePredictionForm({ onSubmit }: CreatePredictionFormProps) {
  const { isConnected } = useWalletStore();
  
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [duration, setDuration] = useState('24'); // hours
  const [reservePrice, setReservePrice] = useState('0');
  
  const [step, setStep] = useState<'form' | 'confirm' | 'processing' | 'success' | 'error'>('form');
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState<number | null>(null);
  
  const durationOptions = [
    { value: '1', label: '1 hour' },
    { value: '6', label: '6 hours' },
    { value: '24', label: '24 hours' },
    { value: '72', label: '3 days' },
    { value: '168', label: '1 week' },
    { value: '720', label: '30 days' },
  ];
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!question.trim()) {
      setError('Question is required');
      return;
    }
    if (!optionA.trim() || !optionB.trim()) {
      setError('Both options are required');
      return;
    }
    if (optionA.trim().toLowerCase() === optionB.trim().toLowerCase()) {
      setError('Options must be different');
      return;
    }
    
    setStep('confirm');
  };
  
  const handleConfirm = async () => {
    setStep('processing');
    setError('');
    
    try {
      const deadline = Math.floor(Date.now() / 1000) + (parseInt(duration) * 3600);
      
      await onSubmit({
        question: question.trim(),
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        deadline,
        reservePrice: BigInt(Math.floor(parseFloat(reservePrice) * 10000000)),
      });
      
      setCreatedId(1); // Would be set from contract response
      setStep('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create prediction');
      setStep('error');
    }
  };
  
  const handleReset = () => {
    setQuestion('');
    setOptionA('');
    setOptionB('');
    setDuration('24');
    setReservePrice('0');
    setStep('form');
    setError('');
    setCreatedId(null);
  };
  
  if (!isConnected) {
    return (
      <div className="bg-dark-100 rounded-2xl border border-gray-800 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Wallet Not Connected</h3>
        <p className="text-gray-400">Connect your wallet to create a prediction market.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-dark-100 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Plus className="w-6 h-6 text-primary-500" />
          <span>Create Prediction Market</span>
        </h2>
        <p className="text-gray-400 mt-1 text-sm">
          Ask a question and let others bet on the outcome.
        </p>
      </div>
      
      {step === 'form' && (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Question */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Question
            </label>
            <div className="relative">
              <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Will Bitcoin exceed $100,000 by December 31, 2025?"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-200 border border-gray-700 text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none"
                maxLength={200}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{question.length}/200 characters</p>
          </div>
          
          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Option A
              </label>
              <input
                type="text"
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
                placeholder="Yes"
                className="w-full px-4 py-3 rounded-xl bg-dark-200 border border-gray-700 text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none"
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Option B
              </label>
              <input
                type="text"
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
                placeholder="No"
                className="w-full px-4 py-3 rounded-xl bg-dark-200 border border-gray-700 text-white placeholder-gray-500 focus:border-secondary-500 focus:outline-none"
                maxLength={50}
              />
            </div>
          </div>
          
          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Betting Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {durationOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    duration === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-200 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Reserve Price */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Bet (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-dark-200 border border-gray-700 text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                XLM
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Set a minimum bet amount to prevent spam (0 = no minimum)
            </p>
          </div>
          
          {/* Info Box */}
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <p className="text-sm text-purple-300">
              <strong>How it works:</strong> Users bet on A or B. After the deadline, the oracle 
              resolves the outcome. Then, the <span className="text-purple-400">MINORITY option holders</span> - 
              those who bet on the less popular choice - win the entire pool!
            </p>
          </div>
          
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium hover:from-primary-500 hover:to-secondary-500 transition-all"
          >
            Continue to Review
          </button>
        </form>
      )}
      
      {step === 'confirm' && (
        <div className="p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white">Review Your Prediction</h3>
          
          <div className="p-4 rounded-xl bg-dark-200 border border-gray-700 space-y-3">
            <div>
              <p className="text-xs text-gray-500">Question</p>
              <p className="text-white font-medium">{question}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Option A</p>
                <p className="text-white">{optionA}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Option B</p>
                <p className="text-white">{optionB}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-white">{durationOptions.find(d => d.value === duration)?.label}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Min Bet</p>
                <p className="text-white">{reservePrice} XLM</p>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={() => setStep('form')}
              className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium hover:from-primary-500 hover:to-secondary-500 transition-all"
            >
              Create Market
            </button>
          </div>
        </div>
      )}
      
      {step === 'processing' && (
        <div className="p-12 text-center">
          <Loader2 className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-white mb-2">Creating Prediction Market</h3>
          <p className="text-gray-400 text-sm">Please confirm in your wallet...</p>
        </div>
      )}
      
      {step === 'success' && (
        <div className="p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Prediction Created!</h3>
          <p className="text-gray-400 mb-6">
            Your prediction market is now open for betting.
          </p>
          {createdId && (
            <p className="text-sm text-gray-500 mb-6">
              Prediction ID: {createdId}
            </p>
          )}
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-500 transition-colors"
          >
            Create Another
          </button>
        </div>
      )}
      
      {step === 'error' && (
        <div className="p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Failed to Create</h3>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => setStep('form')}
            className="w-full py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
