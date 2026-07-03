// Stellar/Soroban Contract Interaction Utilities

import { Address, Networks, Operation, contract, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';

const NULL_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
import { signTransaction as freighterSignTransaction } from '@stellar/freighter-api';
import { useConfigStore, useWalletStore } from './store';

export const TESTNET_CONFIG = {
  networkPassphrase: Networks.TESTNET,
  rpcUrl: 'https://soroban-testnet.stellar.org:443',
};

export const MAINNET_CONFIG = {
  networkPassphrase: Networks.PUBLIC,
  rpcUrl: 'https://soroban-mainnet.stellar.org:443',
};

export const CONTRACT_CONFIG = {
  testnet: 'CC7Y3EYLPK77UYY2SJPMSW57FYKGYSAD2AY2JC5I25ATZUHJHNYGIJXQ',
  mainnet: '',
};

type NetworkName = 'testnet' | 'mainnet';

function normalizeBytesInput(value: string | Uint8Array | Buffer): Buffer {
  if (typeof value !== 'string') {
    return Buffer.from(value);
  }

  var cleaned = value.replace(/^0x/, '').trim();
  if (/^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length % 2 === 0) {
    return Buffer.from(cleaned, 'hex');
  }

  return Buffer.from(value, 'base64');
}

function scValBytesToHex(value: unknown): string {
  if (value instanceof Uint8Array) {
    return '0x' + Buffer.from(value).toString('hex').padStart(64, '0');
  }

  if (Buffer.isBuffer(value)) {
    return '0x' + value.toString('hex').padStart(64, '0');
  }

  if (typeof value === 'string') {
    var trimmed = value.replace(/^0x/, '');
    if (/^[0-9a-fA-F]+$/.test(trimmed)) {
      return '0x' + trimmed.padStart(64, '0');
    }
  }

  return '0x';
}

function asNumber(value: unknown): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return value;
  }

  return Number(value);
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    return BigInt(value);
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      return 0n;
    }
    return BigInt(value);
  }

  if (value === null || value === undefined) {
    return 0n;
  }

  return BigInt(String(value));
}


function normalizePredictionStatus(value: unknown): 'Open' | 'Closed' | 'Settled' {
  if (value && typeof value === 'object') {
    const statusObj = value as { tag?: unknown; variant?: unknown; status?: unknown };
    const tag = String(statusObj.tag ?? statusObj.variant ?? statusObj.status ?? '');
    if (tag === 'Open' || tag === 'Closed' || tag === 'Settled') {
      return tag;
    }

    return normalizePredictionStatus(statusObj.tag ?? statusObj.variant ?? statusObj.status);
  }

  if (typeof value === 'number') {
    return value === 0 ? 'Open' : value === 1 ? 'Closed' : 'Settled';
  }

  if (typeof value === 'bigint') {
    return value === 0n ? 'Open' : value === 1n ? 'Closed' : 'Settled';
  }

  const text = String(value);
  if (text === 'Open' || text === 'Closed' || text === 'Settled') {
    return text;
  }

  return 'Open';
}

function normalizePredictionValue(value: any): any {
  if (!value) {
    return value;
  }

  const params = value.params || {};
  const status = normalizePredictionStatus(value.status);
  return {
    id: asNumber(value.id ?? value.prediction_id ?? 0),
    params: {
      question: String(params.question || ''),
      optionA: String(params.optionA || params.option_a || ''),
      optionB: String(params.optionB || params.option_b || ''),
      deadline: asNumber(params.deadline ?? params._deadline ?? 0),
      reservePrice: asBigInt(params.reservePrice ?? params.reserve_price ?? 0),
      poolToken: params.poolToken || params.pool_token || '',
    },
    status,
    betCount: asNumber(value.betCount ?? value.bet_count ?? 0),
    totalPool: asBigInt(value.totalPool ?? value.total_pool ?? 0),
    countA: value.countA === null || value.countA === undefined ? 0 : asNumber(value.countA ?? value.count_a ?? 0),
    countB: value.countB === null || value.countB === undefined ? 0 : asNumber(value.countB ?? value.count_b ?? 0),
    winningOption:
      value.winningOption === null || value.winningOption === undefined
        ? null
        : asNumber(value.winningOption ?? value.winning_option ?? 0),
    creator: String(value.creator || ''),
  };
}

function normalizeCommitmentValue(value: any): any {
  if (!value) {
    return value;
  }

  return {
    bettor: String(value.bettor || ''),
    commitment: scValBytesToHex(value.commitment || ''),
    escrowAmount: asBigInt(value.escrowAmount ?? value.escrow_amount ?? 0),
  };
}

function buildInvokeArgs(method: string, args: unknown[]): xdr.ScVal[] {
  switch (method) {
    case 'create_prediction':
      return [
        nativeToScVal(args[0], { type: 'address' }),
        nativeToScVal(args[1], { type: 'string' }),
        nativeToScVal(args[2], { type: 'string' }),
        nativeToScVal(args[3], { type: 'string' }),
        nativeToScVal(BigInt(args[4] as bigint | number), { type: 'u64' }),
        nativeToScVal(args[5], { type: 'i128' }),
        nativeToScVal(args[6], { type: 'address' }),
      ];
    case 'commit_bet':
      return [
        nativeToScVal(args[0], { type: 'address' }),
        nativeToScVal(BigInt(args[1] as bigint | number), { type: 'u64' }),
        nativeToScVal(args[2], { type: 'i128' }),
        nativeToScVal(normalizeBytesInput(args[3] as string | Uint8Array | Buffer), { type: 'bytes' }),
        nativeToScVal(args[4], { type: 'i128' }),
      ];
    case 'close_betting':
      return [nativeToScVal(BigInt(args[0] as bigint | number), { type: 'u64' })];
    case 'settle':
      return [
        nativeToScVal(BigInt(args[0] as bigint | number), { type: 'u64' }),
        nativeToScVal(Number(args[1]), { type: 'u32' }),
        nativeToScVal(Number(args[2]), { type: 'u32' }),
        nativeToScVal(Number(args[3]), { type: 'u32' }),
      ];
    case 'claim_reward':
      return [
        nativeToScVal(BigInt(args[0] as bigint | number), { type: 'u64' }),
        nativeToScVal(Number(args[1]), { type: 'u32' }),
        nativeToScVal(normalizeBytesInput(args[2] as string | Uint8Array | Buffer), { type: 'bytes' }),
      ];
    case 'get_prediction':
      return [nativeToScVal(BigInt(args[0] as bigint | number), { type: 'u64' })];
    case 'get_commitment':
      return [
        nativeToScVal(BigInt(args[0] as bigint | number), { type: 'u64' }),
        nativeToScVal(Number(args[1]), { type: 'u32' }),
      ];
    case 'get_vk_hash':
      return [];
    case 'get_prediction_count':
      return [];
    default:
      return args.map(function (arg) { return nativeToScVal(arg); }) as xdr.ScVal[];
  }
}

function getResolvedConfig(network: NetworkName) {
  var config = useConfigStore.getState().config;
  var networkPassphrase = network === 'mainnet' ? MAINNET_CONFIG.networkPassphrase : TESTNET_CONFIG.networkPassphrase;
  var rpcUrl = config.rpcUrl || (network === 'mainnet' ? MAINNET_CONFIG.rpcUrl : TESTNET_CONFIG.rpcUrl);
  var contractId = config.contractId || (network === 'mainnet' ? CONTRACT_CONFIG.mainnet : CONTRACT_CONFIG.testnet);

  return {
    contractId: contractId,
    rpcUrl: rpcUrl,
    networkPassphrase: networkPassphrase,
  };
}

function getWalletAddress(): string {
  var address = useWalletStore.getState().address;
  if (!address) {
    throw new Error('Connect a wallet first.');
  }
  return address;
}

async function signWithFreighterTransaction(xdrEnvelope: string, networkPassphrase: string, address: string) {
  return freighterSignTransaction(xdrEnvelope, {
    networkPassphrase: networkPassphrase,
    address: address,
  });
}

async function invokeContractCall<T>(params: {
  network: NetworkName;
  method: string;
  args: unknown[];
  parseResult?: (value: unknown) => T;
  send?: boolean;
}): Promise<T> {
  var resolved = getResolvedConfig(params.network);
  if (!resolved.contractId) {
    throw new Error('Contract ID is not configured for ' + params.network + '.');
  }

  var publicKey = params.send === false ? NULL_ACCOUNT : getWalletAddress();
  var operation = Operation.invokeContractFunction({
    contract: resolved.contractId,
    function: params.method,
    args: buildInvokeArgs(params.method, params.args),
  });

  var assembled = await contract.AssembledTransaction.buildWithOp(operation, {
    method: params.method,
    args: params.args,
    contractId: resolved.contractId,
    networkPassphrase: resolved.networkPassphrase,
    rpcUrl: resolved.rpcUrl,
    publicKey: publicKey,
    signTransaction: function (txXdr, opts) {
      return signWithFreighterTransaction(txXdr, opts?.networkPassphrase || resolved.networkPassphrase, opts?.address || publicKey);
    },
    parseResultXdr: function (result) {
      return scValToNative(result) as T;
    },
  });

  if (params.send === false) {
    return assembled.result as T;
  }

  var sent = await assembled.signAndSend();
  return sent.result as T;
}

export function getRpcClient(network: NetworkName) {
  var config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
  return new rpc.Server(config.rpcUrl);
}

export class PredictionContract {
  private network: NetworkName;

  constructor(network: NetworkName = 'testnet') {
    this.network = network;
  }

  getContractId(): string {
    var resolved = getResolvedConfig(this.network);
    return resolved.contractId;
  }

  async createPrediction(
    creator: string,
    question: string,
    optionA: string,
    optionB: string,
    deadline: number,
    reservePrice: bigint,
    poolToken: string
  ): Promise<number> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'create_prediction',
      args: [creator, question, optionA, optionB, BigInt(deadline), BigInt(reservePrice), poolToken],
    });
    return asNumber(result);
  }

  async commitBet(
    bettor: string,
    predictionId: number,
    amount: bigint,
    commitment: string,
    escrowAmount: bigint
  ): Promise<number> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'commit_bet',
      args: [bettor, BigInt(predictionId), BigInt(amount), normalizeBytesInput(commitment), BigInt(escrowAmount)],
    });
    console.log(result)
    return asNumber(result);
  }

  async closeBetting(predictionId: number): Promise<boolean> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'close_betting',
      args: [BigInt(predictionId)],
    });
    return Boolean(result);
  }

  async settle(
    predictionId: number,
    winningOption: number,
    countA: number,
    countB: number
  ): Promise<boolean> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'settle',
      args: [BigInt(predictionId), winningOption, countA, countB],
    });
    return Boolean(result);
  }

  async claimReward(
    predictionId: number,
    slot: number,
    proof: string | Uint8Array | Buffer
  ): Promise<bigint> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'claim_reward',
      args: [BigInt(predictionId), BigInt(slot), normalizeBytesInput(proof)],
    });
    return typeof result === 'bigint' ? result : BigInt(result as any);
  }

  async getPrediction(predictionId: number): Promise<any> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'get_prediction',
      args: [BigInt(predictionId)],
      send: false,
    });
    return normalizePredictionValue(result);
  }

  async getCommitment(predictionId: number, slot: number): Promise<any> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'get_commitment',
      args: [BigInt(predictionId), BigInt(slot)],
      send: false,
    });
    return normalizeCommitmentValue(result);
  }

  async getVkHash(): Promise<string> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'get_vk_hash',
      args: [],
      send: false,
    });
    return scValBytesToHex(result);
  }

  async getPredictionCount(): Promise<number> {
    var result = await invokeContractCall<unknown>({
      network: this.network,
      method: 'get_prediction_count',
      args: [],
      send: false,
    });
    return asNumber(result);
  }

  async listPredictions(): Promise<any[]> {
    var predictions: any[] = [];

    try {
      var count = await this.getPredictionCount();
      for (var id = 1; id <= count; id += 1) {
        try {
          var prediction = await this.getPrediction(id);
          predictions.push(prediction);
        } catch {
          break;
        }
      }

      if (predictions.length > 0 || count === 0) {
        return predictions;
      }
    } catch {
      // Fall back to probing sequential IDs when the count view is not deployed yet.
    }

    for (var fallbackId = 1; fallbackId <= 50; fallbackId += 1) {
      try {
        var fallbackPrediction = await this.getPrediction(fallbackId);
        predictions.push(fallbackPrediction);
      } catch {
        break;
      }
    }

    return predictions;
  }
}

export function formatAddress(address: string): string {
  if (address.length <= 8) return address;
  return address.slice(0, 4) + '...' + address.slice(-4);
}

export function formatAmount(amount: bigint, decimals: number = 7): string {
  var divisor = BigInt(10 ** decimals);
  var whole = amount / divisor;
  var fractional = amount % divisor;
  return whole.toLocaleString() + '.' + fractional.toString().padStart(decimals, '0');
}

export function parseAmount(amount: string, decimals: number = 7): bigint {
  var parts = amount.split('.');
  var whole = parts[0] || '0';
  var fractional = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + fractional);
}

export function deadlineToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

export function getTimeRemaining(deadline: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
} {
  var now = Math.floor(Date.now() / 1000);
  var diff = deadline - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    expired: false,
  };
}

export async function submitTransaction(
  transaction: xdr.Transaction,
  source: unknown
): Promise<string> {
  throw new Error('Wallet integration required');
}



