#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT_DIR="${ROOT_DIR}/circuits/prediction_settle"
INPUT_FILE="${1:-${CIRCUIT_DIR}/Prover.toml}"
OUT_DIR="${2:-${CIRCUIT_DIR}/target}"
PROOF_DIR="${3:-${OUT_DIR}/proof.bin}"

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
prediction_id = 1
slot = 0
commitment = "0x01a4c3379fa3f6d0dc0fb702d88c4506ab603e8022bfbe58e68dbd2505d7abc3"
winning_option = 0
vote = 0
nonce = 11
EOF
  echo "Created demo prover input at ${INPUT_FILE}"
  echo "Edit it with your live witness values, then rerun."
  exit 0
fi

mkdir -p "${OUT_DIR}"
INPUT_REAL="$(readlink -f "${INPUT_FILE}")"
PROVER_REAL="$(readlink -f "${CIRCUIT_DIR}/Prover.toml")"
if [[ "${INPUT_REAL}" != "${PROVER_REAL}" ]]; then
  cp "${INPUT_FILE}" "${CIRCUIT_DIR}/Prover.toml"
fi

pushd "${CIRCUIT_DIR}" >/dev/null

echo "[1/2] Executing circuit to generate witness..."
"${NARGO_BIN}" execute --program-dir "${CIRCUIT_DIR}"

WITNESS_FILE="${CIRCUIT_DIR}/target/prediction_settle.gz"
if [[ ! -f "${WITNESS_FILE}" ]]; then
  echo "Expected witness not found at ${WITNESS_FILE}"
  echo "Check your Nargo version or the program output path."
  exit 1
fi

cp "${WITNESS_FILE}" "${OUT_DIR}/prediction_settle.gz"
if [[ -f "${CIRCUIT_DIR}/target/prediction_settle.json" ]]; then
  cp "${CIRCUIT_DIR}/target/prediction_settle.json" "${OUT_DIR}/prediction_settle.json"
fi
if [[ -d "${CIRCUIT_DIR}/target/vk" ]]; then
  mkdir -p "${OUT_DIR}/vk"
  cp -R "${CIRCUIT_DIR}/target/vk/"* "${OUT_DIR}/vk/" 2>/dev/null || true
fi

echo "[2/2] Generating proof..."
"${BB_BIN}" prove \
  -b "${CIRCUIT_DIR}/target/prediction_settle.json" \
  -w "${WITNESS_FILE}" \
  -k "${CIRCUIT_DIR}/target/vk/vk" \
  -o "${PROOF_DIR}" \
  --verifier_target noir-recursive

PROOF_PATH="${PROOF_DIR}"
if [[ -d "${PROOF_DIR}" ]]; then
  PROOF_PATH="${PROOF_DIR}/proof"
fi
xxd -p -c 999999 "${PROOF_PATH}" | tr -d '\n' > "${OUT_DIR}/proof.hex"

echo "Proof written to: ${PROOF_DIR}"
echo "Hex proof written to: ${OUT_DIR}/proof.hex"

popd >/dev/null