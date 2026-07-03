#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT_DIR="${ROOT_DIR}/circuits/prediction_settle"
TMP_DIR="${CIRCUIT_DIR}/target/claim"
PROVER_INPUT="${TMP_DIR}/Prover.toml"
NETWORK="${NETWORK:-testnet}"
IDENTITY="${IDENTITY:-better1}"
PREDICTION_ID="${1:-${PREDICTION_ID:-1}}"
SLOT="${SLOT:-0}"
VOTE="${VOTE:-0}"
NONCE="${NONCE:-11}"
WINNING_OPTION="${WINNING_OPTION:-0}"
CONTRACT_ID="${CONTRACT_ID:-}"

if [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
  if command -v wsl.exe >/dev/null 2>&1; then
    if command -v cygpath >/dev/null 2>&1; then
      WSL_ROOT="$(cygpath -u "$ROOT_DIR")"
    else
      WSL_ROOT="$(wslpath "$ROOT_DIR")"
    fi
    exec wsl bash -lc "cd '$WSL_ROOT' && bash scripts/testnet_claim.sh '$PREDICTION_ID'"
  fi
  echo "This flow must run in WSL."
  exit 1
fi

command -v stellar >/dev/null 2>&1 || { echo "Stellar CLI not found"; exit 1; }

NODE_BIN="$(command -v node 2>/dev/null || command -v node.exe 2>/dev/null || true)"
if [[ -z "${NODE_BIN}" && -x "/mnt/c/Program Files/nodejs/node.exe" ]]; then
  NODE_BIN="/mnt/c/Program Files/nodejs/node.exe"
fi
if [[ -z "${NODE_BIN}" ]]; then
  echo "node not found"
  exit 1
fi

make_commitment_hex() {
  local vote_value="$1"
  local nonce_value="$2"
  (cd "${ROOT_DIR}/web" && "${NODE_BIN}" --input-type=module -e '
    import { buildPoseidon } from "circomlibjs";
    const [voteArg, nonceArg] = process.argv.slice(1);
    const poseidon = await buildPoseidon();
    const commitment = poseidon([BigInt(voteArg), BigInt(nonceArg)]);
    const hex = BigInt(poseidon.F.toObject(commitment)).toString(16).padStart(64, "0");
    console.log(hex);
  ' "$vote_value" "$nonce_value")
}

if [[ -z "${CONTRACT_ID}" ]]; then
  CONTRACT_ID="$(grep -o '"contract_id": *"[^"]*"' "${ROOT_DIR}/.deployment.json" | head -n1 | sed 's/.*"contract_id": *"\([^"]*\)"/\1/')"
fi
if [[ -z "${CONTRACT_ID}" ]]; then
  echo "Could not determine contract id"
  exit 1
fi

mkdir -p "${TMP_DIR}"
COMMITMENT="$(make_commitment_hex "${VOTE}" "${NONCE}")"

cat > "${PROVER_INPUT}" <<EOF
prediction_id = ${PREDICTION_ID}
slot = ${SLOT}
commitment = "0x${COMMITMENT}"
winning_option = ${WINNING_OPTION}
vote = ${VOTE}
nonce = ${NONCE}
EOF

echo "[1/3] Generating claim proof inputs..."
echo "Prediction ID: ${PREDICTION_ID}"
echo "Slot: ${SLOT}"
echo "Vote: ${VOTE}"
echo "Winning option: ${WINNING_OPTION}"
echo "Commitment: 0x${COMMITMENT}"

bash "${ROOT_DIR}/scripts/generate_proof_wsl.sh" "${PROVER_INPUT}" "${TMP_DIR}" "${TMP_DIR}/proof.bin"

if [[ ! -f "${TMP_DIR}/proof.bin/proof" ]]; then
  echo "Proof file not found"
  exit 1
fi

PROOF_HEX="$(tr -d '\n' < "${TMP_DIR}/proof.hex")"

if [[ -z "${CLAIM_SOURCE:-}" ]]; then
  CLAIM_SOURCE="${IDENTITY}"
fi

if ! stellar keys address "${CLAIM_SOURCE}" >/dev/null 2>&1; then
  echo "Claim source key '${CLAIM_SOURCE}' not found. Create or import it first."
  exit 1
fi

if [[ -n "${CHECK_COMMITMENT:-1}" ]]; then
  echo "[2/3] Verifying on-chain commitment..."
  stellar contract invoke \
    --id "${CONTRACT_ID}" \
    --source "${IDENTITY}" \
    --network "${NETWORK}" \
    -- get_commitment \
    --prediction_id "${PREDICTION_ID}" \
    --slot "${SLOT}"
fi

echo "[3/3] Submitting claim_reward..."
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${CLAIM_SOURCE}" \
  --network "${NETWORK}" \
  --send=yes \
  -- claim_reward \
  --prediction_id "${PREDICTION_ID}" \
  --slot "${SLOT}" \
  --proof "${PROOF_HEX}"
echo "Claim submitted."