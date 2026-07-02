#!/bin/bash
# =============================================================================
# zkPrediction - Deployment Script for Stellar Testnet
# =============================================================================
# This script deploys the prediction market contract to Stellar testnet.
#
# Prerequisites:
#   - Stellar CLI installed
#   - Rust toolchain
#   - Nargo (Noir compiler)
#   - Barretenberg (bb)
#
# Usage:
#   ./scripts/deploy_testnet.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  zkPrediction Deployment Script${NC}"
echo -e "${GREEN}  Minority Wins Prediction Market${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if stellar CLI is installed
if ! command -v stellar &> /dev/null; then
    echo -e "${RED}Error: Stellar CLI not found. Install from: https://github.com/stellar/rs-stellar-cli${NC}"
    exit 1
fi

# Configuration
NETWORK="testnet"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
RPC_URL="https://soroban-testnet.stellar.org:443"
IDENTITY="deployer"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Network: $NETWORK"
echo "  Identity: $IDENTITY"
echo "  RPC: $RPC_URL"
echo ""

# Step 1: Configure network
echo -e "${YELLOW}[1/5] Configuring network...${NC}"
stellar network add $NETWORK \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    2>/dev/null || echo "Network already configured"
echo -e "${GREEN}✓ Network configured${NC}"
echo ""

# Step 2: Setup identity
echo -e "${YELLOW}[2/5] Setting up identity...${NC}"
if ! stellar keys ls 2>/dev/null | grep -q "$IDENTITY"; then
    echo "Creating new identity: $IDENTITY"
    stellar keys generate $IDENTITY --network $NETWORK
    stellar keys fund $IDENTITY --network $NETWORK
else
    echo "Identity '$IDENTITY' already exists"
fi
echo -e "${GREEN}✓ Identity ready${NC}"
echo ""

# Step 3: Build contract
echo -e "${YELLOW}[3/5] Building Soroban contract...${NC}"
cd "$(dirname "$0")/.."
stellar contract build --manifest-path contracts/prediction/Cargo.toml
echo -e "${GREEN}✓ Contract built${NC}"
echo ""

# Step 4: Compile Noir circuit
echo -e "${YELLOW}[4/5] Compiling Noir circuit...${NC}"
cd circuits/prediction_settle
nargo compile
echo -e "${GREEN}✓ Circuit compiled${NC}"
echo ""

# Step 5: Generate verification key
echo -e "${YELLOW}[5/5] Generating verification key...${NC}"
cd ../..
mkdir -p circuits/prediction_settle/target/vk
bb write_vk \
    -b circuits/prediction_settle/target/prediction_settle.json \
    -o circuits/prediction_settle/target/vk \
    --verifier_target noir-recursive
echo -e "${GREEN}✓ Verification key generated${NC}"
echo ""

# Calculate VK hash
echo -e "${YELLOW}Computing VK hash...${NC}"
VK_HASH=$(cat circuits/prediction_settle/target/vk/vk_hash)
echo "VK Hash: $VK_HASH"
echo ""

# Deploy contract
echo -e "${YELLOW}Deploying contract...${NC}"
CONTRACT_ID=$(stellar contract deploy \
    --wasm contracts/prediction/target/wasm32v1-none/release/prediction.wasm \
    --source $IDENTITY \
    --network $NETWORK \
    -- --admin $(stellar keys address $IDENTITY) \
    --vk_hash $VK_HASH)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Contract ID: $CONTRACT_ID"
echo "WASM Hash: $(sha256sum contracts/prediction/target/wasm32v1-none/release/prediction.wasm | cut -d' ' -f1)"
echo ""
echo "Save these values for frontend configuration!"
echo ""

# Save deployment info
cat > .deployment.json << EOF
{
    "network": "$NETWORK",
    "contract_id": "$CONTRACT_ID",
    "vk_hash": "$VK_HASH",
    "wasm_hash": "$(sha256sum contracts/prediction/target/wasm32v1-none/release/prediction.wasm | cut -d' ' -f1)",
    "deployed_at": "$(date -Iseconds)"
}
EOF

echo -e "${GREEN}Deployment info saved to .deployment.json${NC}"
