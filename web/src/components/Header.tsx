'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Copy, ExternalLink, LogOut, Wallet } from 'lucide-react';
import { useWalletStore } from '@/lib/store';
import { formatStellarAddress } from '@/lib/wallet';

export default function Header() {
  const pathname = usePathname();
  const { address, isConnected, isConnecting, connect, disconnect } = useWalletStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const navItems = [
    { href: '/', label: 'Browse' },
    { href: '/#markets', label: 'Markets' },
    { href: '/#create', label: 'Create' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-dark-300/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-white">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L22 20H2L12 2Z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <div>
            <div className="font-display text-xl text-white">zkPrediction</div>
            <div className="font-label text-[11px] text-ash-gray">Outcome-based market</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`font-label text-sm transition-colors ${active ? 'text-white' : 'text-ash-gray hover:text-white'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative flex items-center gap-3">
          <span className="hidden rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-silver-mist sm:inline-flex">
            Testnet
          </span>

          {isConnected && address ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-dark-300 text-xs text-white">
                  {address.slice(0, 2)}
                </span>
                <span className="hidden sm:inline">{formatStellarAddress(address)}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-3 w-72 rounded-3xl bg-dark-200 p-4 text-white shadow-2xl shadow-black/40 ring-1 ring-white/10">
                  <p className="font-label text-[11px] text-ash-gray">Connected wallet</p>
                  <p className="mt-1 break-all text-sm text-white">{address}</p>

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-left text-sm text-silver-mist hover:bg-white/10"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{copied ? 'Copied' : 'Copy address'}</span>
                    </button>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm text-silver-mist hover:bg-white/10"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>View on explorer</span>
                    </a>
                    <button
                      onClick={() => {
                        disconnect();
                        setShowDropdown(false);
                      }}
                      className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm text-saffron-spark hover:bg-white/10"
                    >
                      <LogOut className="h-4 w-4" />
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
              className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Wallet className="h-4 w-4" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
