#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_FILE="${ROOT_DIR}/.deployment.json"
NETWORK="${NETWORK:-testnet}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org:443}"
MAX_SCAN="${MAX_SCAN:-50}"

if [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
  if command -v wsl.exe >/dev/null 2>&1; then
    if command -v cygpath >/dev/null 2>&1; then
      WSL_ROOT="$(cygpath -u "$ROOT_DIR")"
    else
      WSL_ROOT="$(wslpath "$ROOT_DIR")"
    fi
    exec wsl bash -lc "cd '$WSL_ROOT' && bash scripts/list_markets.sh"
  fi
  echo "This script must run in WSL."
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "node not found"; exit 1; }

if [[ ! -f "${DEPLOYMENT_FILE}" ]]; then
  echo "Missing .deployment.json"
  exit 1
fi

CONTRACT_ID="$(grep -o '"contract_id": *"[^"]*"' "${DEPLOYMENT_FILE}" | head -n1 | sed 's/.*"contract_id": *"\([^"]*\)"/\1/')"
if [[ -z "${CONTRACT_ID}" ]]; then
  echo "Could not determine contract id"
  exit 1
fi

export CONTRACT_ID NETWORK RPC_URL MAX_SCAN ROOT_DIR

cd "${ROOT_DIR}/web"
node --input-type=module <<'EOF'
import { Networks, contract } from '@stellar/stellar-sdk';

const contractId = process.env.CONTRACT_ID;
if (!contractId) {
  throw new Error('Missing CONTRACT_ID env var');
}
const rpcUrl = process.env.RPC_URL || 'https://soroban-testnet.stellar.org:443';
const networkPassphrase = process.env.NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const maxScan = Number(process.env.MAX_SCAN || '50');

const client = await contract.Client.from({
  contractId,
  rpcUrl,
  networkPassphrase,
});

function toJson(value) {
  return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
}

const markets = [];

try {
  const countTx = await client.get_prediction_count();
  const count = Number(countTx.result ?? 0);
  for (let id = 1; id <= count; id += 1) {
    try {
      const tx = await client.get_prediction({ prediction_id: id });
      markets.push(tx.result);
    } catch {
      break;
    }
  }
} catch {
  for (let id = 1; id <= maxScan; id += 1) {
    try {
      const tx = await client.get_prediction({ prediction_id: id });
      markets.push(tx.result);
    } catch {
      break;
    }
  }
}

console.log(toJson({ contractId, markets }));
EOF
