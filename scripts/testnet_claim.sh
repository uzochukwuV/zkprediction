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
WINNING_OPTION="${WINNING_OPTION:-}"
CONTRACT_ID="${CONTRACT_ID:-}"
CLAIM_SOURCE="${CLAIM_SOURCE:-${IDENTITY}}"
CLAIM_DEBUG="${CLAIM_DEBUG:-1}"

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

json_field() {
  local key="$1"
  local json="$2"
  printf '%s' "$json" | sed -n "s/.*\"${key}\":\([^,}]*\).*/\1/p" | sed 's/^"//; s/"$//'
}

if [[ -z "${CONTRACT_ID}" ]]; then
  CONTRACT_ID="$(grep -o '"contract_id": *"[^"]*"' "${ROOT_DIR}/.deployment.json" | head -n1 | sed 's/.*"contract_id": *"\([^"]*\)"/\1/')"
fi
if [[ -z "${CONTRACT_ID}" ]]; then
  echo "Could not determine contract id"
  exit 1
fi

if [[ -z "${WINNING_OPTION}" ]]; then
  PREDICTION_JSON="$(stellar contract invoke \
    --id "${CONTRACT_ID}" \
    --source "${IDENTITY}" \
    --network "${NETWORK}" \
    -- get_prediction \
    --prediction_id "${PREDICTION_ID}")"
  WINNING_OPTION_RAW="$(json_field winning_option "${PREDICTION_JSON}")"
  if [[ -z "${WINNING_OPTION_RAW}" || "${WINNING_OPTION_RAW}" == "null" ]]; then
    echo "Prediction has not been settled yet or winning option is missing."
    exit 1
  fi
  WINNING_OPTION="${WINNING_OPTION_RAW}"
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

echo "[1/4] Preparing claim inputs"
echo "Prediction ID: ${PREDICTION_ID}"
echo "Slot: ${SLOT}"
echo "Vote: ${VOTE}"
echo "Nonce: ${NONCE}"
echo "Winning option: ${WINNING_OPTION}"
echo "Local commitment: 0x${COMMITMENT}"

echo "[2/4] Generating claim proof..."
bash "${ROOT_DIR}/scripts/generate_proof_wsl.sh" "${PROVER_INPUT}" "${TMP_DIR}" "${TMP_DIR}/proof.bin"

PROOF_BYTES_FILE="${TMP_DIR}/proof.bin/proof"
PUBLIC_INPUTS_FILE="${TMP_DIR}/proof.bin/public_inputs"
PROOF_HEX_FILE="${TMP_DIR}/proof.hex"

if [[ ! -s "${PROOF_BYTES_FILE}" ]]; then
  echo "Proof bytes file is empty: ${PROOF_BYTES_FILE}"
  exit 1
fi
if [[ ! -s "${PUBLIC_INPUTS_FILE}" ]]; then
  echo "Public inputs file is empty: ${PUBLIC_INPUTS_FILE}"
  exit 1
fi
if [[ ! -s "${PROOF_HEX_FILE}" ]]; then
  echo "Proof hex file is empty: ${PROOF_HEX_FILE}"
  exit 1
fi

PROOF_HEX="$(tr -d '\n' < "${PROOF_HEX_FILE}")"
PROOF_PUBLIC_INPUTS_HEX="$(xxd -p -c 999999 "${PUBLIC_INPUTS_FILE}" | tr -d '\n')"
PROOF_BYTES_LEN="$(wc -c < "${PROOF_BYTES_FILE}" | tr -d '[:space:]')"
PUBLIC_INPUTS_LEN="$(wc -c < "${PUBLIC_INPUTS_FILE}" | tr -d '[:space:]')"

if [[ "${CLAIM_DEBUG}" != "0" ]]; then
  echo "[debug] proof bytes length: ${PROOF_BYTES_LEN}"
  echo "[debug] public inputs length: ${PUBLIC_INPUTS_LEN}"
  echo "[debug] proof hex length: ${#PROOF_HEX}"
fi

if [[ -n "${CHECK_COMMITMENT:-1}" ]]; then
  echo "[3/4] Verifying on-chain commitment..."
  COMMITMENT_JSON="$(stellar contract invoke \
    --id "${CONTRACT_ID}" \
    --source "${IDENTITY}" \
    --network "${NETWORK}" \
    -- get_commitment \
    --prediction_id "${PREDICTION_ID}" \
    --slot "${SLOT}")"
  echo "${COMMITMENT_JSON}"
  ONCHAIN_COMMITMENT_RAW="$(json_field commitment "${COMMITMENT_JSON}")"
  if [[ -z "${ONCHAIN_COMMITMENT_RAW}" ]]; then
    echo "Failed to read on-chain commitment."
    exit 1
  fi
  if [[ "${ONCHAIN_COMMITMENT_RAW}" != "${COMMITMENT}" ]]; then
    echo "On-chain commitment mismatch."
    echo "Local : ${COMMITMENT}"
    echo "Chain : ${ONCHAIN_COMMITMENT_RAW}"
    exit 1
  fi
fi

if [[ "${CLAIM_DEBUG}" != "0" ]]; then
  PACKED_INPUTS_JSON="$(stellar contract invoke \
    --id "${CONTRACT_ID}" \
    --source "${IDENTITY}" \
    --network "${NETWORK}" \
    -- pack_claim_public_inputs_view \
    --prediction_id "${PREDICTION_ID}" \
    --slot "${SLOT}" \
    --commitment "${ONCHAIN_COMMITMENT_RAW:-${COMMITMENT}}" \
    --winning_option "${WINNING_OPTION}")"
  PACKED_INPUTS_HEX="$(printf '%s' "${PACKED_INPUTS_JSON}" | tr -d '"[:space:]')"
  echo "[debug] packed public inputs: ${PACKED_INPUTS_JSON}"
  if [[ "${PROOF_PUBLIC_INPUTS_HEX}" != "${PACKED_INPUTS_HEX}" ]]; then
    echo "Public inputs mismatch."
    echo "Proof : ${PROOF_PUBLIC_INPUTS_HEX}"
    echo "Chain : ${PACKED_INPUTS_HEX}"
    exit 1
  fi
  VERIFY_RESULT="$(stellar contract invoke \
    --id "${CONTRACT_ID}" \
    --source "${IDENTITY}" \
    --network "${NETWORK}" \
    -- verify_proof \
    --proof "${PROOF_HEX}" \
    --public_inputs "${PROOF_PUBLIC_INPUTS_HEX}")"
  echo "[debug] verify_proof result: ${VERIFY_RESULT}"
  echo "[debug] invoking claim_reward with proof from ${PROOF_HEX_FILE}"
fi

echo "[4/4] Submitting claim_reward..."
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