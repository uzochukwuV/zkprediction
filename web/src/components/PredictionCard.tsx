'use client';

import { useState, useEffect } from 'react';
import { Prediction, PredictionStatus } from '@/types';
import { getTimeRemaining, formatAmount } from '@/lib/contract';
import { TrendingUp, Clock, Users, ChevronRight, Lock, CheckCircle, AlertCircle } from 'lucide-react';

interface PredictionCardProps {
  prediction: Prediction;
  onSelect?: (id: number) => void;
}

const statusConfig: Record<PredictionStatus, { 
  color: string; 
  bgColor: string; 
  icon: React.ReactNode;
  label: string;
}> = {
  Open: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/30',
    icon: <Clock className="w-4 h-4" />,
    label: 'Open for Betting',
  },
  Closed: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10 border-yellow-500/30',
    icon: <Lock className="w-4 h-4" />,
    label: 'Betting Closed',
  },
  Resolved: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Resolved - Pending Settlement',
  },
  Settled: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/30',
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'Settled',
  },
};

export default function PredictionCard({ prediction, onSelect }: PredictionCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(prediction.params.deadline));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(prediction.params.deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [prediction.params.deadline]);

  const status = statusConfig[prediction.status];
  const totalBettors = prediction.countA + prediction.countB;
  const majorityOption = prediction.countA > prediction.countB ? 'A' : 'B';
  const minorityOption = prediction.countA > prediction.countB ? 'B' : 'A';

  const handleClick = () => {
    if (onSelect) onSelect(prediction.id);
  };

  return (
    <div 
      onClick={handleClick}
      className="bg-dark-100 rounded-2xl border border-gray-800 hover:border-primary-500/50 transition-all cursor-pointer overflow-hidden group"
    >
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium border ${status.bgColor} ${status.color}`}>
                {status.icon}
                <span>{status.label}</span>
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors">
              {prediction.params.question}
            </h3>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-primary-400 transition-colors" />
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className={`p-4 rounded-xl border ${
            prediction.winningOption === 0 
              ? 'bg-green-500/10 border-green-500/50' 
              : prediction.minorityOption === 0 && prediction.status === 'Resolved'
                ? 'bg-purple-500/10 border-purple-500/50'
                : 'bg-gray-800/50 border-gray-700'
          }`}>
            <p className="text-sm text-gray-400 mb-1">Option A</p>
            <p className="text-xl font-bold text-white">{prediction.params.optionA}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {prediction.countA} bettors
              </span>
              {prediction.winningOption === 0 && (
                <span className="text-xs text-green-400 font-medium">WINNER</span>
              )}
              {prediction.minorityOption === 0 && prediction.status === 'Resolved' && (
                <span className="text-xs text-purple-400 font-medium">MINORITY WINS</span>
              )}
            </div>
          </div>

          <div className={`p-4 rounded-xl border ${
            prediction.winningOption === 1 
              ? 'bg-green-500/10 border-green-500/50' 
              : prediction.minorityOption === 1 && prediction.status === 'Resolved'
                ? 'bg-purple-500/10 border-purple-500/50'
                : 'bg-gray-800/50 border-gray-700'
          }`}>
            <p className="text-sm text-gray-400 mb-1">Option B</p>
            <p className="text-xl font-bold text-white">{prediction.params.optionB}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {prediction.countB} bettors
              </span>
              {prediction.winningOption === 1 && (
                <span className="text-xs text-green-400 font-medium">WINNER</span>
              )}
              {prediction.minorityOption === 1 && prediction.status === 'Resolved' && (
                <span className="text-xs text-purple-400 font-medium">MINORITY WINS</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-4 bg-dark-200/50 border-t border-gray-800">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Pool Size</p>
            <p className="text-sm font-semibold text-white">
              {formatAmount(prediction.totalPool, 7)} XLM
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Bettors</p>
            <p className="text-sm font-semibold text-white flex items-center justify-center space-x-1">
              <Users className="w-3 h-3" />
              <span>{totalBettors}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Majority</p>
            <p className="text-sm font-semibold text-yellow-400">
              {majorityOption} ({Math.max(prediction.countA, prediction.countB)})
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Minority</p>
            <p className="text-sm font-semibold text-purple-400">
              {minorityOption} ({Math.min(prediction.countA, prediction.countB)})
            </p>
          </div>
        </div>

        {prediction.status === 'Open' && mounted && !timeRemaining.expired && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Time Remaining</span>
              <span className="text-white font-mono">
                {timeRemaining.days > 0 && `${timeRemaining.days}d `}
                {timeRemaining.hours > 0 && `${timeRemaining.hours}h `}
                {timeRemaining.minutes}m {timeRemaining.seconds}s
              </span>
            </div>
          </div>
        )}

        {prediction.status === 'Resolved' && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Settlement</span>
              <span className="text-purple-400 font-medium">
                {prediction.minorityCount} winners share {formatAmount(prediction.minorityTotal || BigInt(0), 7)} XLM
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
