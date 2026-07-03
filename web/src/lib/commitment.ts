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
  predictionId: number,
  slot: number,
  commitment: string,
  winningOption: number
): string {
  return (
    '0x' +
    [
      toHex32(BigInt(predictionId)),
      toHex32(BigInt(slot)),
      normalizeHex32(commitment),
      toHex32(BigInt(winningOption)),
    ].join('')
  );
}

export function unpackPublicInputs(data: string): {
  predictionId: bigint;
  slot: bigint;
  commitment: string;
  winningOption: bigint;
} {
  const hex = data.replace(/^0x/, '');
  let offset = 0;
  const read = () => {
    const part = hex.slice(offset, offset + 64);
    offset += 64;
    return part;
  };
  const readField = () => BigInt('0x' + read());
  return {
    predictionId: readField(),
    slot: readField(),
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
  predictionId: number,
  slot: number,
  vote: number,
  nonce: string
): Promise<{ commitment: string; publicInputs: string }> {
  const commitment = await commitmentFromVote(vote, nonce);
  return {
    commitment,
    publicInputs: packPublicInputs(predictionId, slot, commitment, vote),
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
  return [
    `prediction_id = ${inputs.predictionId}`,
    `slot = ${inputs.slot}`,
    `commitment = "${inputs.commitment}"`,
    `winning_option = ${inputs.winningOption}`,
    `vote = ${inputs.vote}`,
    `nonce = "${inputs.nonce}"`,
  ].join('\n');
}