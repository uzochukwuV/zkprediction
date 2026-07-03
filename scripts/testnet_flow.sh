#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
  if command -v wsl.exe >/dev/null 2>&1; then
    if command -v cygpath >/dev/null 2>&1; then
      WSL_ROOT="$(cygpath -u "$ROOT_DIR")"
    else
      WSL_ROOT="$(wslpath "$ROOT_DIR")"
    fi
    exec wsl bash -lc "cd '$WSL_ROOT' && bash scripts/testnet_flow.sh"
  fi
  echo -e "${RED}This flow must run in WSL.${NC}"
  exit 1
fi

DEPLOY_SCRIPT="${ROOT_DIR}/scripts/deploy_testnet.sh"
NETWORK="testnet"
IDENTITY="deployer"
POOL_TOKEN="${POOL_TOKEN:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
QUESTION="${QUESTION:-Will Bitcoin exceed \$100,000 by Dec 31, 2025?}"
OPTION_A="${OPTION_A:-Yes}"
OPTION_B="${OPTION_B:-No}"
RESERVE_PRICE="${RESERVE_PRICE:-0}"
DEADLINE_SECONDS="${DEADLINE_SECONDS:-30}"
WINNING_OPTION="${WINNING_OPTION:-0}"
BET_ONE="${BET_ONE:-1000000}"
BET_TWO="${BET_TWO:-1000000}"

command -v stellar >/dev/null 2>&1 || { echo -e "${RED}Stellar CLI not found${NC}"; exit 1; }

NODE_BIN="$(command -v node 2>/dev/null || command -v node.exe 2>/dev/null || true)"
if [[ -z "${NODE_BIN}" && -x "/mnt/c/Program Files/nodejs/node.exe" ]]; then
  NODE_BIN="/mnt/c/Program Files/nodejs/node.exe"
fi

make_commitment_hex() {
  local vote="$1"
  local nonce="$2"
  if [[ -z "${NODE_BIN}" ]]; then
    echo "node not found"
    exit 1
  fi
  (cd "${ROOT_DIR}/web" && "${NODE_BIN}" --input-type=module -e '
    import { buildPoseidon } from "circomlibjs";
    const [voteArg, nonceArg] = process.argv.slice(1);
    const poseidon = await buildPoseidon();
    const commitment = poseidon([BigInt(voteArg), BigInt(nonceArg)]);
    const hex = BigInt(poseidon.F.toObject(commitment)).toString(16).padStart(64, "0");
    console.log(hex);
  ' "$vote" "$nonce")
}

parse_contract_id() {
  grep -o '"contract_id": *"[^"]*"' "${ROOT_DIR}/.deployment.json" | head -n1 | sed 's/.*"contract_id": *"\([^"]*\)"/\1/'
}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  zkPrediction Testnet Lifecycle${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${YELLOW}[1/4] Deploying contract to testnet...${NC}"
bash "${DEPLOY_SCRIPT}"
CONTRACT_ID="$(parse_contract_id)"
if [[ -z "${CONTRACT_ID}" ]]; then
  echo -e "${RED}Could not read contract id from .deployment.json${NC}"
  exit 1
fi

echo "Contract ID: ${CONTRACT_ID}"
echo ""

DEPLOYER_ADDRESS="$(stellar keys address "${IDENTITY}")"
DEADLINE="$(($(date +%s) + DEADLINE_SECONDS))"

echo -e "${YELLOW}[2/4] Creating market...${NC}"
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${IDENTITY}" \
  --network "${NETWORK}" \
  -- create_prediction \
  --creator "${DEPLOYER_ADDRESS}" \
  --question "${QUESTION}" \
  --option_a "${OPTION_A}" \
  --option_b "${OPTION_B}" \
  --deadline "${DEADLINE}" \
  --reserve_price "${RESERVE_PRICE}" \
  --pool_token "${POOL_TOKEN}" >/tmp/zkprediction_create_market.log 2>&1

PREDICTION_ID=1

echo "Prediction ID: ${PREDICTION_ID}"
echo "Deadline: ${DEADLINE}"
echo ""

echo -e "${YELLOW}[3/4] Committing votes...${NC}"
stellar keys generate better1 --network "${NETWORK}" --fund 2>/dev/null || true
stellar keys generate better2 --network "${NETWORK}" --fund 2>/dev/null || true

BETTER1="$(stellar keys address better1)"
BETTER2="$(stellar keys address better2)"

VOTE1=0
NONCE1=11
COMMITMENT1="$(make_commitment_hex "${VOTE1}" "${NONCE1}")"

VOTE2=1
NONCE2=12
COMMITMENT2="$(make_commitment_hex "${VOTE2}" "${NONCE2}")"

stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source better1 \
  --network "${NETWORK}" \
  -- commit_bet \
  --bettor "${BETTER1}" \
  --prediction_id "${PREDICTION_ID}" \
  --amount "${BET_ONE}" \
  --commitment "${COMMITMENT1}" \
  --escrow_amount "${BET_ONE}"

stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source better2 \
  --network "${NETWORK}" \
  -- commit_bet \
  --bettor "${BETTER2}" \
  --prediction_id "${PREDICTION_ID}" \
  --amount "${BET_TWO}" \
  --commitment "${COMMITMENT2}" \
  --escrow_amount "${BET_TWO}"

echo "Votes committed with hidden commitments."
echo ""

echo -e "${YELLOW}[4/4] Closing and settling...${NC}"
sleep "${DEADLINE_SECONDS}"
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${IDENTITY}" \
  --network "${NETWORK}" \
  -- close_betting \
  --prediction_id "${PREDICTION_ID}"

COUNT_A=1
COUNT_B=1
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${IDENTITY}" \
  --network "${NETWORK}" \
  -- settle \
  --prediction_id "${PREDICTION_ID}" \
  --winning_option "${WINNING_OPTION}" \
  --count_a "${COUNT_A}" \
  --count_b "${COUNT_B}"

echo ""
echo -e "${GREEN}Testnet lifecycle complete${NC}"
echo "Contract ID: ${CONTRACT_ID}"
echo "Prediction ID: ${PREDICTION_ID}"
echo "Winning option: ${WINNING_OPTION}"
echo "Counts: A=${COUNT_A} B=${COUNT_B}"
echo ""
echo "Next step: generate a claim proof for the winning bettor and call claim_reward."
