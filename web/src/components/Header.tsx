'use client';

import { useWalletStore } from '@/lib/store';
import { formatStellarAddress } from '@/lib/wallet';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWalletStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  return (
    <header className="bg-dark-200 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">zkPrediction</h1>
              <p className="text-xs text-gray-400">Minority Wins Market</p>
            </div>
          </div>

          {/* Network Badge */}
          <div className="hidden sm:block">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
              Testnet
            </span>
          </div>

          {/* Wallet Connection */}
          <div className="relative">
            {isConnected && address ? (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-dark-100 border border-gray-700 hover:border-primary-500 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {address.slice(0, 2)}
                    </span>
                  </div>
                  <span className="text-white font-medium">
                    {formatStellarAddress(address)}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-dark-100 border border-gray-700 shadow-xl py-2">
                    <div className="px-4 py-2 border-b border-gray-700">
                      <p className="text-xs text-gray-400">Connected Wallet</p>
                      <p className="text-sm text-white font-mono mt-1">
                        {formatStellarAddress(address, 8)}
                      </p>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={handleCopy}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 flex items-center space-x-2"
                      >
                        <Copy className="w-4 h-4" />
                        <span>{copied ? 'Copied!' : 'Copy Address'}</span>
                      </button>
                      <a
                        href={`https://stellar.expert/explorer/testnet/account/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 flex items-center space-x-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>View on Explorer</span>
                      </a>
                    </div>
                    <div className="border-t border-gray-700 pt-2">
                      <button
                        onClick={handleDisconnect}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-800 flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="flex items-center space-x-2 px-6 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium hover:from-primary-500 hover:to-secondary-500 transition-all disabled:opacity-50"
              >
                <Wallet className="w-5 h-5" />
                <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
