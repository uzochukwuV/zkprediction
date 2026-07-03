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
    exec wsl bash -lc "cd '$WSL_ROOT' && bash scripts/deploy_testnet.sh"
  fi
  echo -e "${RED}Error: this deployment script must run in WSL.${NC}"
  exit 1
fi

if ! command -v stellar &> /dev/null; then
  echo -e "${RED}Error: Stellar CLI not found. Install from: https://github.com/stellar/rs-stellar-cli${NC}"
  exit 1
fi

NARGO_BIN="$(command -v nargo 2>/dev/null || true)"
if [[ -z "${NARGO_BIN}" && -x "/home/vic/.nargo/bin/nargo" ]]; then
  NARGO_BIN="/home/vic/.nargo/bin/nargo"
fi
if [[ -z "${NARGO_BIN}" ]]; then
  echo -e "${RED}Error: nargo not found.${NC}"
  exit 1
fi

BB_BIN="$(command -v bb 2>/dev/null || true)"
if [[ -z "${BB_BIN}" && -x "/home/vic/.bb/bb" ]]; then
  BB_BIN="/home/vic/.bb/bb"
fi
if [[ -z "${BB_BIN}" ]]; then
  echo -e "${RED}Error: bb not found.${NC}"
  exit 1
fi

NETWORK="testnet"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
RPC_URL="https://soroban-testnet.stellar.org:443"
IDENTITY="deployer"

cd "$(dirname "$0")/.."

CIRCUIT_DIR="${ROOT_DIR}/circuits/prediction_settle"
VK_DIR="${CIRCUIT_DIR}/target/vk"
VK_BYTES_PATH="${VK_DIR}/vk"
VK_HASH_PATH="${VK_DIR}/vk_hash"


echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  zkPrediction Deployment Script${NC}"
echo -e "${GREEN}  Outcome Based Prediction Market${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${YELLOW}[1/5] Configuring network...${NC}"
stellar network add $NETWORK --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" 2>/dev/null || true

echo -e "${YELLOW}[2/5] Setting up identity...${NC}"
if ! stellar keys ls 2>/dev/null | grep -q "$IDENTITY"; then
  stellar keys generate $IDENTITY --network $NETWORK
  stellar keys fund $IDENTITY --network $NETWORK
fi

echo -e "${YELLOW}[3/5] Building Soroban contract...${NC}"
stellar contract build --manifest-path contracts/prediction/Cargo.toml

echo -e "${YELLOW}[4/5] Compiling Noir circuit...${NC}"
cd "$CIRCUIT_DIR"
"${NARGO_BIN}" compile

echo -e "${YELLOW}[5/5] Generating verification key...${NC}"
rm -rf "$VK_DIR" "${CIRCUIT_DIR}/target/vk_fields.json"
mkdir -p "$VK_DIR"
"${BB_BIN}" write_vk \
  -b target/prediction_settle.json \
  -o "$VK_DIR" \
  -t noir-recursive
VK_HASH_HEX="$(xxd -p -c 999999 "$VK_HASH_PATH" | tr -d '\n')"

cd "$ROOT_DIR"

echo -e "${YELLOW}Deploying contract...${NC}"
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/prediction.wasm \
  --source $IDENTITY \
  --network $NETWORK \
  -- --admin $(stellar keys address $IDENTITY) \
  --vk_bytes-file-path "$VK_BYTES_PATH")

cat > .deployment.json << EOF
{
  "network": "$NETWORK",
  "contract_id": "$CONTRACT_ID",
  "vk_hash": "$VK_HASH_HEX",
  "vk_bytes_path": "$VK_BYTES_PATH",
  "wasm_hash": "$(sha256sum target/wasm32v1-none/release/prediction.wasm | cut -d' ' -f1)",
  "deployed_at": "$(date -Iseconds)"
}
EOF

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Contract ID: $CONTRACT_ID"