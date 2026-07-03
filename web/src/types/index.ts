// Types for zkPrediction - outcome-based prediction market

export interface PredictionParams {
  question: string;
  optionA: string;
  optionB: string;
  deadline: number;
  reservePrice: bigint;
  poolToken: string;
}

export type PredictionStatus = 'Open' | 'Closed' | 'Settled';

export interface Prediction {
  id: number;
  params: PredictionParams;
  status: PredictionStatus;
  betCount: number;
  totalPool: bigint;
  countA: number;
  countB: number;
  winningOption: number | null;
  creator: string;
}

export interface Commitment {
  bettor: string;
  commitment: string;
  escrowAmount: bigint;
}

export interface Bet {
  slot: number;
  choice: number;
  amount: bigint;
  commitment: string;
  blindingFactor: string;
  timestamp: number;
}

export interface CreatePredictionInput {
  question: string;
  optionA: string;
  optionB: string;
  deadline: number;
  reservePrice: bigint;
}

export interface CommitBetInput {
  predictionId: number;
  choice: number;
  amount: bigint;
  blindingFactor: string;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export interface TransactionState {
  pending: boolean;
  hash: string | null;
  error: string | null;
}

export interface ZKProof {
  proof: string;
  publicInputs: string;
  vkHash: string;
}

export interface ContractConfig {
  contractId: string;
  network: 'testnet' | 'mainnet';
  rpcUrl: string;
}

export interface PredictionCreatedEvent {
  id: number;
  creator: string;
  deadline: number;
}

export interface BetCommittedEvent {
  predictionId: number;
  slot: number;
  bettor: string;
  choice: number;
  amount: bigint;
}

export interface PredictionSettledEvent {
  predictionId: number;
  winningOption: number;
  countA: number;
  countB: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UserBet {
  predictionId: number | bigint;
  choice: number | bigint;
  amount: bigint| number;
  blindingFactor: string;
  slot: number | bigint;
  committed: boolean;
  claimed: boolean;
}