#!/bin/bash
# =============================================================================
# zkPrediction - End-to-End Settlement Test Script
# =============================================================================
# This script demonstrates the full prediction market lifecycle:
# 1. Create a prediction question
# 2. Commit bets (private)
# 3. Close betting
# 4. Oracle resolves the outcome
# 5. Generate ZK proof (you do this locally)
# 6. Settle and distribute rewards
#
# Usage:
#   ./scripts/e2e_test_settle.sh <contract_id>
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONTRACT_ID="${1:-CDHSVJYDZDCZPEZXOS5A7QGYOYAOEX6MUHJV6M3ZTXMQ5B5PKRWEG7LU}"
NETWORK="testnet"
IDENTITY="deployer"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  zkPrediction E2E Settlement Test${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
DEPLOYER=$(stellar keys address $IDENTITY)
DEADLINE=$(($(date +%s) + 60)) # 1 minute from now

echo -e "${YELLOW}[Step 1] Create Prediction Question${NC}"
echo "Question: Will Bitcoin exceed \$100,000 by Dec 31, 2025?"
echo "Options: Yes / No"
echo "Deadline: $DEADLINE"
echo ""

PREDICTION_ID=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- create_prediction \
    --creator $DEPLOYER \
    --question "Will Bitcoin exceed \$100,000 by Dec 31, 2025?" \
    --option_a "Yes" \
    --option_b "No" \
    --deadline $DEADLINE \
    --reserve_price 0 \
    --pool_token "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" 2>&1 | grep -o '[0-9]*')

echo -e "${GREEN}✓ Prediction created! ID: $PREDICTION_ID${NC}"
echo ""

echo -e "${YELLOW}[Step 2] Simulate Multiple Betters${NC}"
echo "Creating test identities..."
stellar keys generate better1 --network $NETWORK --fund 2>/dev/null || true
stellar keys generate better2 --network $NETWORK --fund 2>/dev/null || true
stellar keys generate better3 --network $NETWORK --fund 2>/dev/null || true
stellar keys generate better4 --network $NETWORK --fund 2>/dev/null || true

echo "Committing bets..."
echo "  - better1: Bets 100 on Yes (majority)"
echo "  - better2: Bets 50 on Yes (majority)"
echo "  - better3: Bets 200 on Yes (majority)"
echo "  - better4: Bets 50 on No (MINORITY!)"

# Commit bet 1 (Yes - majority)
stellar contract invoke \
    --id $CONTRACT_ID \
    --source better1 \
    --network $NETWORK \
    -- commit_bet \
    --bettor $(stellar keys address better1) \
    --prediction_id $PREDICTION_ID \
    --choice 0 \
    --amount 100000000 \
    --commitment 0x$(openssl rand -hex 32) \
    --escrow_amount 100000000 >/dev/null 2>&1

# Commit bet 2 (Yes - majority)
stellar contract invoke \
    --id $CONTRACT_ID \
    --source better2 \
    --network $NETWORK \
    -- commit_bet \
    --bettor $(stellar keys address better2) \
    --prediction_id $PREDICTION_ID \
    --choice 0 \
    --amount 50000000 \
    --commitment 0x$(openssl rand -hex 32) \
    --escrow_amount 50000000 >/dev/null 2>&1

# Commit bet 3 (Yes - majority)
stellar contract invoke \
    --id $CONTRACT_ID \
    --source better3 \
    --network $NETWORK \
    -- commit_bet \
    --bettor $(stellar keys address better3) \
    --prediction_id $PREDICTION_ID \
    --choice 0 \
    --amount 200000000 \
    --commitment 0x$(openssl rand -hex 32) \
    --escrow_amount 200000000 >/dev/null 2>&1

# Commit bet 4 (No - minority!)
stellar contract invoke \
    --id $CONTRACT_ID \
    --source better4 \
    --network $NETWORK \
    -- commit_bet \
    --bettor $(stellar keys address better4) \
    --prediction_id $PREDICTION_ID \
    --choice 1 \
    --amount 50000000 \
    --commitment 0x$(openssl rand -hex 32) \
    --escrow_amount 50000000 >/dev/null 2>&1

echo -e "${GREEN}✓ All bets committed!${NC}"
echo ""

# Wait for deadline
echo -e "${YELLOW}[Step 3] Waiting for betting deadline...${NC}"
sleep 65
echo -e "${GREEN}✓ Deadline passed${NC}"
echo ""

echo -e "${YELLOW}[Step 4] Close Betting Phase${NC}"
stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- close_betting \
    --prediction_id $PREDICTION_ID >/dev/null 2>&1

echo -e "${GREEN}✓ Betting closed${NC}"
echo ""

echo -e "${YELLOW}[Step 5] Oracle Resolution${NC}"
echo "Simulating oracle: The prediction resolved to 'Yes'"
stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- resolve \
    --prediction_id $PREDICTION_ID \
    --winning_option 0 >/dev/null 2>&1

echo -e "${GREEN}✓ Prediction resolved: Yes wins!${NC}"
echo "   But the MINORITY (No with 1 bettor) wins the pool!"
echo ""

echo -e "${YELLOW}[Step 6] Query Final State${NC}"
stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- get_prediction \
    --prediction_id $PREDICTION_ID 2>&1 | grep -v "^ℹ️\|^🌎\|^✅"

echo ""
echo -e "${YELLOW}[Step 7] ZK Proof Generation (Manual)${NC}"
echo "=================================================="
echo "The ZK proof must be generated locally using:"
echo ""
echo "  # Generate witness"
echo "  nargo execute --program-dir circuits/prediction_settle"
echo ""
echo "  # Generate proof"
echo "  bb prove \\"
echo "    -b circuits/prediction_settle/target/prediction_settle.json \\"
echo "    -w circuits/prediction_settle/target/prediction_settle.gz \\"
echo "    -k circuits/prediction_settle/target/vk \\"
echo "    -o proof.bin \\"
echo "    --verifier_target noir-recursive"
echo ""
echo "  # Settle with proof"
echo "  stellar contract invoke \\"
echo "    --id $CONTRACT_ID \\"
echo "    --source $IDENTITY \\"
echo "    --network $NETWORK \\"
echo "    -- settle \\"
echo "    --prediction_id $PREDICTION_ID \\"
echo "    --proof \$(cat proof.bin | xxd -p -c 999999) \\"
echo "    --public_inputs <packed_inputs>"
echo ""
echo -e "${YELLOW}==================================================${NC}"
echo ""
echo -e "${GREEN}Test Summary:${NC}"
echo "  Total Pool: 400,000,000 (400 XLM)"
echo "  Majority: Yes (3 bettors, 350 XLM)"
echo "  Minority: No (1 bettor, 50 XLM)"
echo ""
echo -e "${RED}  Result: If 'Yes' wins AND 'No' was minority,${NC}"
echo -e "${RED}  the single 'No' bettor wins ALL 400 XLM!${NC}"
echo ""
echo "  That's a 8x return on 50 XLM!"
echo ""
echo -e "${GREEN}========================================${NC}"
