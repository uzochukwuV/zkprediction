// Commitment generation and verification utilities
// Users generate commitments locally to keep their bets private

// Generate a random blinding factor
export function generateBlindingFactor(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Simple hash function for commitment (in production, use proper Keccak/Pedersen)
export async function hashCommitment(
  choice: number,
  amount: bigint,
  blindingFactor: string
): Promise<string> {
  const data = `${choice}:${amount.toString()}:${blindingFactor}`;
  
  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return '0x' + hashHex;
}

// Verify commitment matches inputs
export async function verifyCommitment(
  commitment: string,
  choice: number,
  amount: bigint,
  blindingFactor: string
): Promise<boolean> {
  const computed = await hashCommitment(choice, amount, blindingFactor);
  return computed === commitment;
}

// Pack public inputs for ZK circuit
export function packPublicInputs(
  predictionId: number,
  poolToken: string,
  commitments: string[],
  winningOption: number,
  minorityOption: number,
  minorityCount: number,
  totalPool: bigint,
  minorityTotal: bigint,
  reservePrice: bigint,
  deadline: number
): string {
  const parts: string[] = [];
  
  // prediction_id (u64)
  parts.push(predictionId.toString(16).padStart(16, '0'));
  
  // pool_token (address - 56 chars)
  parts.push(poolToken.replace('G', '0'));
  
  // commitments array (16 x 32 bytes)
  for (let i = 0; i < 16; i++) {
    const commitment = commitments[i] || '0'.repeat(64);
    parts.push(commitment.replace('0x', ''));
  }
  
  // winning_option (u32)
  parts.push(winningOption.toString(16).padStart(8, '0'));
  
  // minority_option (u32)
  parts.push(minorityOption.toString(16).padStart(8, '0'));
  
  // minority_count (u32)
  parts.push(minorityCount.toString(16).padStart(8, '0'));
  
  // total_pool (i128 - 32 bytes hex)
  parts.push(totalPool.toString(16).padStart(32, '0'));
  
  // minority_total (i128 - 32 bytes hex)
  parts.push(minorityTotal.toString(16).padStart(32, '0'));
  
  // reserve_price (i128)
  parts.push(reservePrice.toString(16).padStart(32, '0'));
  
  // deadline (u64)
  parts.push(deadline.toString(16).padStart(16, '0'));
  
  return '0x' + parts.join('');
}

// Unpack public inputs from contract response
export function unpackPublicInputs(data: string): {
  predictionId: number;
  poolToken: string;
  commitments: string[];
  winningOption: number;
  minorityOption: number;
  minorityCount: number;
  totalPool: bigint;
  minorityTotal: bigint;
  reservePrice: bigint;
  deadline: number;
} {
  const hex = data.replace('0x', '');
  let offset = 0;
  
  const read = (length: number): string => {
    const part = hex.slice(offset, offset + length);
    offset += length;
    return part;
  };
  
  const parseU64 = (hex: string): number => parseInt(hex, 16);
  const parseI128 = (hex: string): bigint => BigInt('0x' + hex);
  
  return {
    predictionId: parseU64(read(16)),
    poolToken: 'G' + read(56),
    commitments: Array.from({ length: 16 }, () => '0x' + read(64)),
    winningOption: parseU64(read(8)),
    minorityOption: parseU64(read(8)),
    minorityCount: parseU64(read(8)),
    totalPool: parseI128(read(32)),
    minorityTotal: parseI128(read(32)),
    reservePrice: parseI128(read(32)),
    deadline: parseU64(read(16)),
  };
}

// Calculate potential payout for minority bettors
export function calculatePayout(
  totalPool: bigint,
  minorityTotal: bigint,
  yourBet: bigint
): bigint {
  if (minorityTotal === BigInt(0)) return BigInt(0);
  return (totalPool * yourBet) / minorityTotal;
}

// Calculate expected return multiplier
export function calculateMultiplier(
  totalPool: bigint,
  minorityTotal: bigint
): number {
  if (minorityTotal === BigInt(0)) return 0;
  return Number(totalPool) / Number(minorityTotal);
}
