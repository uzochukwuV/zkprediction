'use client';

import { TrendingUp, Users, Clock, Shield, Zap, Lock } from 'lucide-react';

const features = [
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Private Betting',
    description: 'Your bets are hidden using cryptographic commitments until settlement.',
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Minority Wins',
    description: 'Contrarian bets pay big. The less popular option wins the entire pool!',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'ZK Verified',
    description: 'All settlements are mathematically proven using zero-knowledge proofs.',
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Secure Escrow',
    description: 'Funds are locked until ZK-verified settlement ensures fair distribution.',
  },
];

export default function Features() {
  return (
    <section className="py-20 bg-dark-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">
            How <span className="gradient-text">zkPrediction</span> Works
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            A new kind of prediction market where being contrarian pays off.
          </p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-dark-100 rounded-2xl p-6 border border-gray-800 hover:border-primary-500/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-400 flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
