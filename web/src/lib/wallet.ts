// Wallet connection utilities for Freighter, Albedo, and other Stellar wallets

import { getAddress, isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';

function getNetworkPassphrase(network: string): string {
  const normalized = network.toLowerCase();
  if (normalized === 'testnet') {
    return 'Test SDF Network ; September 2015';
  }

  if (normalized === 'mainnet' || normalized === 'public') {
    return 'Public Global Stellar Network ; September 2015';
  }

  return network;
}

// Check if Freighter is available
export async function isFreighterAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return true;
}

// Connect to Freighter wallet
export async function connectFreighter(): Promise<string | null> {
  console.log("hello")
  try {
    if (typeof window === 'undefined') {
      console.log("null")
      return null;
    }

    const connected = await isConnected();
    console.log(connected, "nil")
      await requestAccess()
    if (!connected) {
      const access = await requestAccess();
      if (access.error || !access.address) {
        console.log('Please allow access in Freighter wallet');
        return null;
      }
      return access.address;
    }
    console.log("all")

    const address = await getAddress();
    console.log(address)
    return address.error ? null : address.address;
  } catch (error) {
    console.error('Failed to connect to Freighter:', error);
    return null;
  }
}

// Sign transaction with Freighter
export async function signWithFreighter(
  transactionXDR: string,
  network: string
): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;

    const signed = await signTransaction(transactionXDR, {
      networkPassphrase: getNetworkPassphrase(network),
    });

    return signed.error ? null : signed.signedTxXdr;
  } catch (error) {
    console.error('Failed to sign transaction:', error);
    return null;
  }
}

// Get wallet info
export interface WalletInfo {
  address: string;
  name: string;
  icon?: string;
}

// Detect available wallets
export async function detectWallets(): Promise<WalletInfo[]> {
  const wallets: WalletInfo[] = [];

  // Check Freighter
  const hasFreighter = await isFreighterAvailable();
  if (hasFreighter) {
    wallets.push({
      address: 'freighter',
      name: 'Freighter',
      icon: '/wallets/freighter.png',
    });
  }

  // Check Albedo (simulated - Albedo uses postMessage)
  if (typeof window !== 'undefined') {
    wallets.push({
      address: 'albedo',
      name: 'Albedo',
      icon: '/wallets/albedo.png',
    });
  }

  return wallets;
}

// Simple keypair generation for local testing (NOT for production)
export function generateTestKeypair(): { publicKey: string; secretKey: string } {
  // This is for testing only - use proper wallet in production
  const keypair = {
    publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    secretKey: 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYLDH',
  };
  return keypair;
}

// Validate Stellar address
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}

// Format address for display
export function formatStellarAddress(address: string, chars: number = 4): string {
  if (!address || address.length < chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}