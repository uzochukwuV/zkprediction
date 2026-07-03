import { buildPoseidon } from 'circomlibjs';

let poseidonPromise: Promise<any> | null = null;

async function getPoseidon() {
  poseidonPromise ??= buildPoseidon();
  return poseidonPromise;
}

function hexToBigInt(value: string): bigint {
  const clean = value.replace(/^0x/, '').trim();
  return clean ? BigInt('0x' + clean) : 0n;
}

function toHex32(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

function normalizeHex32(value: string): string {
  return value.replace(/^0x/, '').padStart(64, '0');
}

export function generateBlindingFactor(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashCommitment(choice: number, nonce: string): Promise<string> {
  const poseidon = await getPoseidon();
  const nonceValue = hexToBigInt(nonce);
  const commitment = poseidon([BigInt(choice), nonceValue]);
  const fieldValue = BigInt(poseidon.F.toObject(commitment));
  return '0x' + toHex32(fieldValue);
}

export async function verifyCommitment(commitment: string, choice: number, nonce: string): Promise<boolean> {
  return (await hashCommitment(choice, nonce)) === commitment;
}

export function packPublicInputs(
  commitment: string,
  winningOption: number
): string {
  // Contract expects: [commitment (32 bytes), winning_option (u64 padded to 32 bytes)]
  // Note: prediction_id and slot are NOT public inputs - they're used to look up
  // the stored commitment on-chain
  return (
    '0x' +
    [
      normalizeHex32(commitment),
      toHex32(BigInt(winningOption)),
    ].join('')
  );
}

export function unpackPublicInputs(data: string): {
  commitment: string;
  winningOption: bigint;
} {
  const hex = data.replace(/^0x/, '');
  const read = () => hex.slice(0, 64);
  const readField = () => BigInt('0x' + read());
  return {
    commitment: '0x' + read(),
    winningOption: readField(),
  };
}

export function calculatePayout(totalPool: bigint, winningCount: bigint, yourBet: bigint): bigint {
  if (winningCount === 0n) return 0n;
  return (totalPool * yourBet) / winningCount;
}

export function calculateMultiplier(totalPool: bigint, winningCount: bigint): number {
  if (winningCount === 0n) return 0;
  return Number(totalPool) / Number(winningCount);
}

export async function commitmentFromVote(vote: number, nonce: string): Promise<string> {
  return hashCommitment(vote, nonce);
}

export async function makeProofInputs(
  vote: number,
  nonce: string
): Promise<{ commitment: string; publicInputs: string }> {
  const commitment = await commitmentFromVote(vote, nonce);
  return {
    commitment,
    publicInputs: packPublicInputs(commitment, vote),
  };
}

export interface ClaimProofInputs {
  predictionId: number;
  slot: number;
  commitment: string;
  winningOption: number;
  vote: number;
  nonce: string;
}

export async function buildClaimProofInputs(
  predictionId: number,
  slot: number,
  vote: number,
  nonce: string,
  winningOption: number
): Promise<ClaimProofInputs> {
  const commitment = await commitmentFromVote(vote, nonce);
  return {
    predictionId,
    slot,
    commitment,
    winningOption,
    vote,
    nonce,
  };
}

export function formatClaimProverToml(inputs: ClaimProofInputs): string {
  // Note: prediction_id and slot are NOT public inputs
  // They're used to look up the commitment on-chain
  // The ZK circuit only sees: commitment, winning_option, vote, nonce
  return [
    `[verifier]`,
    `# Public inputs (will be verified against contract storage)`,
    `commitment = "${inputs.commitment}"`,
    `winning_option = ${inputs.winningOption}`,
    ``,
    `[witness]`,
    `# Private inputs (never revealed on-chain)`,
    `vote = ${inputs.vote}`,
    `nonce = "${inputs.nonce}"`,
  ].join('\n');
}