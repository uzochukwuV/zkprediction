#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT_DIR="${ROOT_DIR}/circuits/prediction_settle"
INPUT_FILE="${1:-${CIRCUIT_DIR}/Prover.toml}"
OUT_DIR="${2:-${CIRCUIT_DIR}/target/claim}"
PROOF_DIR="${3:-${OUT_DIR}/proof.bin}"
VK_DIR="${4:-${OUT_DIR}/vk}"

if ! grep -qi microsoft /proc/version 2>/dev/null; then
  echo "This script is intended to run in WSL."
  exit 1
fi

NARGO_BIN="$(command -v nargo 2>/dev/null || true)"
if [[ -z "${NARGO_BIN}" && -x "/home/vic/.nargo/bin/nargo" ]]; then
  NARGO_BIN="/home/vic/.nargo/bin/nargo"
fi
if [[ -z "${NARGO_BIN}" ]]; then
  echo "nargo not found"
  exit 1
fi

BB_BIN="$(command -v bb 2>/dev/null || true)"
if [[ -z "${BB_BIN}" && -x "/home/vic/.bb/bb" ]]; then
  BB_BIN="/home/vic/.bb/bb"
fi
if [[ -z "${BB_BIN}" ]]; then
  echo "bb not found"
  exit 1
fi

if [[ ! -f "${INPUT_FILE}" ]]; then
  cat > "${INPUT_FILE}" <<'EOF'
commitment = "0x01a4c3379fa3f6d0dc0fb702d88c4506ab603e8022bfbe58e68dbd2505d7abc3"
winning_option = 0
vote = 0
nonce = 11
EOF
  echo "Created demo prover input at ${INPUT_FILE}"
  echo "Edit it with your live witness values, then rerun."
  exit 0
fi

mkdir -p "${OUT_DIR}" "${PROOF_DIR}" "${VK_DIR}"
INPUT_REAL="$(readlink -f "${INPUT_FILE}")"
PROVER_REAL="$(readlink -f "${CIRCUIT_DIR}/Prover.toml")"
if [[ "${INPUT_REAL}" != "${PROVER_REAL}" ]]; then
  cp "${INPUT_FILE}" "${CIRCUIT_DIR}/Prover.toml"
fi

pushd "${CIRCUIT_DIR}" >/dev/null

echo "[1/3] Compiling circuit..."
"${NARGO_BIN}" compile

echo "[2/3] Generating witness..."
"${NARGO_BIN}" execute

WITNESS_FILE="${CIRCUIT_DIR}/target/prediction_settle.gz"
if [[ ! -f "${WITNESS_FILE}" ]]; then
  echo "Expected witness not found at ${WITNESS_FILE}"
  echo "Check your Nargo version or the program output path."
  exit 1
fi

if [[ -f "${CIRCUIT_DIR}/target/prediction_settle.json" ]]; then
  cp "${CIRCUIT_DIR}/target/prediction_settle.json" "${OUT_DIR}/prediction_settle.json"
fi

echo "[3/3] Generating VK and proof..."
"${BB_BIN}" write_vk \
  -s ultra_honk \
  --oracle_hash keccak \
  -b "${CIRCUIT_DIR}/target/prediction_settle.json" \
  -o "${VK_DIR}"

"${BB_BIN}" prove \
  -s ultra_honk \
  --oracle_hash keccak \
  --bytecode_path "${CIRCUIT_DIR}/target/prediction_settle.json" \
  --witness_path "${WITNESS_FILE}" \
  --output_path "${PROOF_DIR}"

if [[ -f "${PROOF_DIR}/proof" ]]; then
  PROOF_PATH="${PROOF_DIR}/proof"
elif [[ -f "${PROOF_DIR}" ]]; then
  PROOF_PATH="${PROOF_DIR}"
else
  echo "Expected proof bytes not found in ${PROOF_DIR}"
  exit 1
fi

xxd -p -c 999999 "${PROOF_PATH}" | tr -d '\n' > "${OUT_DIR}/proof.hex"

echo "VK written to: ${VK_DIR}/vk"
echo "Proof written to: ${PROOF_DIR}/proof"
echo "Hex proof written to: ${OUT_DIR}/proof.hex"

popd >/dev/null