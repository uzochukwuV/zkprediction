// Wallet connection utilities for Freighter, Albedo, and other Stellar wallets

// Check if Freighter is available
export async function isFreighterAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return !!(window as any).freighter;
}

// Connect to Freighter wallet
export async function connectFreighter(): Promise<string | null> {
  try {
    // Check for Freighter API
    const freighter = (window as any).freighter;
    if (!freighter) {
      console.log('Please install Freighter wallet extension');
      return null;
    }
    
    // Get the API
    const api = await freighter.api();
    const isConnected = await api.isConnected();
    
    if (!isConnected) {
      console.log('Please allow access in Freighter wallet');
      return null;
    }
    
    const publicKey = await api.getPublicKey();
    return publicKey;
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
    const freighter = (window as any).freighter;
    if (!freighter) return null;
    
    const api = await freighter.api();
    const signedXDR = await api.signTransaction(transactionXDR, { network });
    return signedXDR;
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
