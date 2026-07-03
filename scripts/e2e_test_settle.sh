#!/bin/bash
# =============================================================================
# zkPrediction - End-to-End Settlement Test Script
# =============================================================================
# Outcome-based flow:
# 1. Create a prediction question
# 2. Commit bets with hidden answers
# 3. Close betting
# 4. Admin settles by posting the winning answer and counts
# 5. Winners prove their commitment matches the settled answer
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONTRACT_ID="${1:-CDHSVJYDZDCZPEZXOS5A7QGYOYAOEX6MUHJV6M3ZTXMQ5B5PKRWEG7LU}"
NETWORK="testnet"
IDENTITY="deployer"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  zkPrediction E2E Outcome Test${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

DEPLOYER=$(stellar keys address $IDENTITY)
DEADLINE=$(($(date +%s) + 60))

echo -e "${YELLOW}[Step 1] Create Prediction Question${NC}"
echo "Question: Will Bitcoin exceed $100,000 by Dec 31, 2025?"
echo "Options: Yes / No"
echo "Deadline: $DEADLINE"
echo ""

PREDICTION_ID=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- create_prediction \
    --creator $DEPLOYER \
    --question "Will Bitcoin exceed $100,000 by Dec 31, 2025?" \
    --option_a "Yes" \
    --option_b "No" \
    --deadline $DEADLINE \
    --reserve_price 0 \
    --pool_token "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" 2>&1 | grep -o '[0-9]*')

echo -e "${GREEN}Prediction created! ID: $PREDICTION_ID${NC}"
echo ""

echo -e "${YELLOW}[Step 2] Commit sealed bets${NC}"
echo "Bidders keep their answers private on-chain."
echo ""

stellar keys generate better1 --network $NETWORK --fund 2>/dev/null || true
stellar keys generate better2 --network $NETWORK --fund 2>/dev/null || true

stellar contract invoke \
    --id $CONTRACT_ID \
    --source better1 \
    --network $NETWORK \
    -- commit_bet \
    --bettor $(stellar keys address better1) \
    --prediction_id $PREDICTION_ID \
    --amount 100000000 \
    --commitment 0x00000000000000000000000000000000000000000000000000000002422c4b2d \
    --escrow_amount 100000000 >/dev/null 2>&1

stellar contract invoke \
    --id $CONTRACT_ID \
    --source better2 \
    --network $NETWORK \
    -- commit_bet \
    --bettor $(stellar keys address better2) \
    --prediction_id $PREDICTION_ID \
    --amount 50000000 \
    --commitment 0x000000000000000000000000000000000000000000000000000000048457229a \
    --escrow_amount 50000000 >/dev/null 2>&1

echo -e "${GREEN}All bets committed${NC}"
echo ""

echo -e "${YELLOW}[Step 3] Waiting for betting deadline...${NC}"
sleep 65
echo -e "${GREEN}Deadline passed${NC}"
echo ""

echo -e "${YELLOW}[Step 4] Close Betting Phase${NC}"
stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- close_betting \
    --prediction_id $PREDICTION_ID >/dev/null 2>&1

echo -e "${GREEN}Betting closed${NC}"
echo ""

echo -e "${YELLOW}[Step 5] Generate ZK proof locally${NC}"
echo "Use scripts/generate_proof_wsl.sh inside WSL after updating circuits/prediction_settle/Prover.toml with the live witness values."
echo ""

echo -e "${YELLOW}[Step 6] Settle with proof${NC}"
echo "After proof generation, call settle with:"
echo "  prediction_id = $PREDICTION_ID"
echo "  winning_option = <0 or 1>"
echo "  count_a = <count>"
echo "  count_b = <count>"
echo "  proof = <hex proof bytes>"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Outcome-based settlement flow ready${NC}"
echo -e "${GREEN}========================================${NC}"