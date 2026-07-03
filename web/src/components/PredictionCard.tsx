'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Clock, Lock, TrendingUp, Users } from 'lucide-react';
import { Prediction, PredictionStatus } from '@/types';
import { formatAmount, getTimeRemaining } from '@/lib/contract';

interface PredictionCardProps {
  prediction: Prediction;
  onSelect?: (id: number) => void;
}

const statusConfig: Record<PredictionStatus, { color: string; label: string; ring: string }> = {
  Open: { color: 'text-emerald-300', label: 'Open', ring: 'bg-emerald-500/10' },
  Closed: { color: 'text-amber-300', label: 'Closed', ring: 'bg-amber-500/10' },
  Settled: { color: 'text-violet-300', label: 'Settled', ring: 'bg-violet-500/10' },
};

export default function PredictionCard({ prediction, onSelect }: PredictionCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(prediction.params.deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(prediction.params.deadline));
    }, 1000);

    return () => clearInterval(interval);
  }, [prediction.params.deadline]);

  const status = statusConfig[prediction.status];

  return (
    <button
      onClick={() => onSelect?.(prediction.id)}
      className="group w-full border-b border-white/8 py-6 text-left transition-colors hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)] lg:items-start">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${status.color} ${status.ring}`}>
              {status.label}
            </span>
            <span className="font-label text-[11px] text-ash-gray">Market #{prediction.id}</span>
          </div>

          <h3 className="max-w-4xl font-display text-2xl leading-tight text-white sm:text-3xl lg:text-[42px]">
            {prediction.params.question}
          </h3>

          <div className="flex flex-wrap items-center gap-4 text-sm text-silver-mist">
            <span>{prediction.params.optionA}</span>
            <span className="text-white/20">/</span>
            <span>{prediction.params.optionB}</span>
            <span className="text-white/20">/</span>
            <span>{formatAmount(prediction.totalPool, 7)} XLM pool</span>
          </div>
        </div>

        <div className="space-y-4 lg:text-right">
          <div className="flex items-center justify-between gap-4 lg:block">
            <div>
              <p className="font-label text-[11px] text-ash-gray">Bettors</p>
              <p className="mt-1 text-2xl font-medium text-white">{prediction.betCount}</p>
            </div>
            <div>
              <p className="font-label text-[11px] text-ash-gray">Split</p>
              <p className="mt-1 text-2xl font-medium text-white">
                {prediction.countA}:{prediction.countB}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/8 pt-4 text-sm text-silver-mist lg:justify-end lg:gap-8">
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{prediction.countA + prediction.countB} participants</span>
            </span>
            {prediction.status === 'Open' && !timeRemaining.expired ? (
              <span className="inline-flex items-center gap-2 text-white">
                <Clock className="h-4 w-4" />
                <span>
                  {timeRemaining.days > 0 && `${timeRemaining.days}d `}
                  {timeRemaining.hours > 0 && `${timeRemaining.hours}h `}
                  {timeRemaining.minutes}m
                </span>
              </span>
            ) : prediction.status === 'Settled' ? (
              <span className="inline-flex items-center gap-2 text-violet-300">
                <TrendingUp className="h-4 w-4" />
                <span>Winner option {prediction.winningOption === 0 ? 'A' : 'B'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-amber-300">
                <Lock className="h-4 w-4" />
                <span>Betting closed</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end text-xs text-ash-gray transition-colors group-hover:text-white">
        <span>Open market</span>
        <ChevronRight className="ml-2 h-4 w-4" />
      </div>
    </button>
  );
}
