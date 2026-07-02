# zkPrediction - Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Smart Contract Design](#smart-contract-design)
3. [ZK Circuit Design](#zk-circuit-design)
4. [Privacy Model](#privacy-model)
5. [Minority Wins Mechanism](#minority-wins-mechanism)
6. [Build Instructions](#build-instructions)
7. [API Reference](#api-reference)
8. [Security Considerations](#security-considerations)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           zkPrediction                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐         ┌─────────────────┐                       │
│   │   Web UI    │────────▶│ Soroban Contract │                       │
│   │  (Next.js)  │         │   (on-chain)     │                       │
│   └─────────────┘         └────────┬────────┘                       │
│                                   │                                  │
│                                   ▼                                  │
│                         ┌─────────────────┐                          │
│                         │  Stellar Network │                         │
│                         │   (Soroban)     │                          │
│                         └─────────────────┘                          │
│                                   │                                  │
│                                   ▼                                  │
│                         ┌─────────────────┐                          │
│                         │ Noir Circuit    │◀────── Off-chain          │
│                         │ (ZK Proof)      │       Prover             │
│                         └─────────────────┘                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Components

1. **Soroban Smart Contract**: Handles betting, escrow, and settlement
2. **Noir ZK Circuit**: Verifies settlement correctness without revealing bets
3. **Web Frontend**: User interface for creating and betting on predictions

---

## Smart Contract Design

### State Machine

```
┌─────────┐    commit_bet    ┌─────────┐   close_betting   ┌───────────┐
│  OPEN   │─────────────────▶│  OPEN   │─────────────────▶│  CLOSED   │
└─────────┘                   │         │                   └───────────┘
      │                       └─────────┘                          │
      │                             │                               │
      │                             │ resolve                      │
      │                             ▼                               │
      │                      ┌───────────┐                          │
      └─────────────────────▶│ RESOLVED │◀────────────────────────┘
                             └───────────┘
                                   │
                                   │ settle (with ZK proof)
                                   ▼
                             ┌──────────┐
                             │ SETTLED  │
                             └──────────┘
```

### Data Structures

#### Prediction
```rust
struct Prediction {
    id: u64,
    params: PredictionParams,
    status: PredictionStatus,
    bet_count: u32,
    total_pool: i128,
    count_a: u32,        // Number of bettors on Option A
    count_b: u32,        // Number of bettors on Option B
    winning_option: Option<u32>,
    minority_option: Option<u32>,
    minority_count: Option<u32>,
    minority_total: Option<i128>,
    creator: Address,
}
```

#### Commitment
```rust
struct Commitment {
    bettor: Address,
    commitment: BytesN<32>,  // hash(choice, amount, blinding)
    escrow_amount: i128,
}
```

---

## ZK Circuit Design

### Circuit Purpose

The ZK circuit proves that:
1. All commitments can be opened to valid (choice, amount, blinding) tuples
2. The minority option is correctly calculated (fewest bettors)
3. The total pool and minority totals are correct
4. The distribution amounts are mathematically valid

### Public Inputs

```
prediction_id     - ID of the prediction
pool_token        - Token address used for betting
commitments[16]   - Array of commitment hashes
winning_option    - The resolved winning option (0 or 1)
minority_option   - The calculated minority option (0 or 1)
minority_count    - Number of bettors on minority option
total_pool        - Total amount in the pool
minority_total    - Total amount bet on minority option
reserve_price     - Minimum bet amount
deadline          - Unix timestamp of betting deadline
```

### Private Inputs (Witness)

```
choices[16]       - Actual choices (0 or 1) for each slot
amounts[16]        - Bet amounts for each slot
blindings[16]     - Random blinding factors
active[16]         - Whether each slot has a bet
```

### Circuit Logic

```noir
fn main(
    // ... inputs ...
) {
    // 1. Verify all commitments
    for i in 0..N {
        if active[i] {
            let expected = hash(choices[i], amounts[i], blindings[i]);
            assert(commitments[i] == expected);
            
            // Count by option
            if choices[i] == 0 { count_a++; sum_a += amounts[i]; }
            else { count_b++; sum_b += amounts[i]; }
        }
    }
    
    // 2. Determine minority (fewest bettors)
    let expected_minority = if count_a < count_b { 0 } else { 1 };
    assert(minority_option == expected_minority);
    
    // 3. Verify totals
    assert(total_pool == sum_a + sum_b);
    assert(minority_total == (expected_minority == 0 ? sum_a : sum_b));
}
```

---

## Privacy Model

### What Is Private

- **Individual bet amounts**: Only the total for each option is public
- **Individual choices**: Only counts are public, not who bet what
- **Blinding factors**: Never revealed

### What Is Public

- **Commitments**: Hashes of (choice, amount, blinding)
- **Counts**: How many bettors chose each option
- **Totals**: Total amount bet on each option
- **Minority calculation**: Who the minority is
- **Final result**: Who won and how much they receive

### Privacy vs. Verifiability

```
┌─────────────────────────────────────────────────────────────┐
│                     Information Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Private (Prover Only)          Public (Everyone)         │
│   ───────────────────           ───────────────────         │
│                                                             │
│   • Your choice               • Commitment hash             │
│   • Your amount               • Total counts                │
│   • Your blinding factor      • Option totals               │
│                             • Minority option              │
│                             • Your payout (after settle)    │
│                                                             │
│                            Verifiable (ZK Proof)            │
│                            ─────────────────────            │
│                            • Your commitment is valid       │
│                            • Totals are correct             │
│                            • Payout is correct              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Minority Wins Mechanism

### Core Concept

In a **traditional prediction market**:
```
Total Pool: 1000 XLM
Yes bets: 800 XLM (8 bettors)
No bets: 200 XLM (2 bettors)

If Yes wins: 8 bettors split 200 XLM = 25 XLM each
If No wins: 2 bettors split 800 XLM = 400 XLM each
```

In **zkPrediction (Minority Wins)**:
```
Total Pool: 1000 XLM
Yes bets: 800 XLM (8 bettors)
No bets: 200 XLM (2 bettors)

If Yes wins AND No is minority:
  → The 2 "No" bettors receive ALL 1000 XLM!
  → 500 XLM each (2.5x their bet)

If No wins AND Yes is minority:
  → The 8 "Yes" bettors receive ALL 1000 XLM!
  → 125 XLM each (1.25x their bet)

Note: The winning OPTION and the MINORITY may differ!
```

### Why Minority Wins

1. **Contrarian incentive**: Rewards those who identify overlooked outcomes
2. **Information discovery**: If most bet on A, but A wins, minority on B still profits
3. **Market balance**: Natural tendency to balance bets
4. **Speculation tool**: Can bet on both sides strategically

### Strategic Implications

```
Scenario: You believe "Yes" has 70% chance of winning

Option 1: Bet on Yes
  - Safer (majority wins if Yes wins)
  - But if Yes wins AND Yes is majority → share pool with losers

Option 2: Bet on No  
  - Riskier (lose if Yes wins)
  - But if Yes wins AND No is minority → win entire pool!

Optimal strategy depends on:
  1. Your probability estimate
  2. Your estimate of others' probability estimates
  3. The payoff math (minority bonus vs. win probability)
```

---

## Build Instructions

### Prerequisites

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none

# Stellar CLI
cargo install rs-stellar-cli

# Noir (Nargo)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash

# Barretenberg
nargo backend install barretenberg --method gcc
```

### Build Contract

```bash
# Build Soroban contract
stellar contract build --manifest-path contracts/prediction/Cargo.toml

# Output: contracts/prediction/target/wasm32v1-none/release/prediction.wasm
```

### Build Circuit

```bash
# Compile Noir circuit
cd circuits/prediction_settle
nargo compile

# Output: circuits/prediction_settle/target/prediction_settle.json
```

### Generate Verification Key

```bash
# Generate VK
bb write_vk \
    -b circuits/prediction_settle/target/prediction_settle.json \
    -o circuits/prediction_settle/target/vk \
    --verifier_target noir-recursive

# Output: 
#   circuits/prediction_settle/target/vk/vk
#   circuits/prediction_settle/target/vk/vk_hash
```

### Run Tests

```bash
# Contract tests
cargo test --manifest-path contracts/prediction/Cargo.toml

# Circuit tests
nargo test --program-dir circuits/prediction_settle
```

---

## API Reference

### Contract Functions

#### create_prediction
```javascript
stellar contract invoke \
    --id <CONTRACT_ID> \
    --source <CREATOR> \
    -- create_prediction \
    --creator <ADDRESS> \
    --question "<QUESTION>" \
    --option_a "<TEXT>" \
    --option_b "<TEXT>" \
    --deadline <TIMESTAMP> \
    --reserve_price <I128> \
    --pool_token <ADDRESS>
```

#### commit_bet
```javascript
stellar contract invoke \
    --id <CONTRACT_ID> \
    --source <BETTOR> \
    -- commit_bet \
    --bettor <ADDRESS> \
    --prediction_id <U64> \
    --choice <U32> \
    --amount <I128> \
    --commitment <BYTES> \
    --escrow_amount <I128>
```

#### close_betting
```javascript
stellar contract invoke \
    --id <CONTRACT_ID> \
    --source <OPERATOR> \
    -- close_betting \
    --prediction_id <U64>
```

#### resolve
```javascript
stellar contract invoke \
    --id <CONTRACT_ID> \
    --source <OPERATOR> \
    -- resolve \
    --prediction_id <U64> \
    --winning_option <U32>
```

#### settle
```javascript
stellar contract invoke \
    --id <CONTRACT_ID> \
    --source <OPERATOR> \
    -- settle \
    --prediction_id <U64> \
    --proof <BYTES> \
    --public_inputs <BYTES>
```

#### get_prediction
```javascript
stellar contract invoke \
    --id <CONTRACT_ID> \
    -- get_prediction \
    --prediction_id <U64>
```

---

## Security Considerations

### Strengths

| Feature | Protection |
|---------|------------|
| **Private bets** | Commitments hide choices until settlement |
| **ZK verification** | Mathematically proven correctness |
| **On-chain escrow** | Funds locked until verified settlement |
| **Replay protection** | Proof hash prevents double-settlement |
| **Deadline enforcement** | No late bets allowed |

### Potential Risks

| Risk | Mitigation |
|------|------------|
| **Trusted oracle** | Use decentralized oracle networks (Chainlink, Pyth) |
| **Circuit bugs** | Extensive testing, audits |
| **Key management** | Secure VK storage, upgrade path |
| **Proof front-running** | Commitments sealed until deadline |
| **Griefing** | Minimum bet requirements, anti-spam |

### Known Limitations

1. **Minority = 0**: If no one bets on one option, that option is minority with 0 bettors. Pool goes to... nobody. Consider minimum bet rules.

2. **Equal counts**: When counts are equal, the logic defaults to Option B as minority. This could be exploited in specific scenarios.

3. **Proof generation**: Requires significant computation (~16GB RAM for UltraHonk). Consider ZK-as-a-service for production.

---

## File Structure

```
zkprediction/
├── README.md              # Overview
├── DOCUMENTATION.md       # This file
├── LICENSE                # MIT
│
├── circuits/
│   └── prediction_settle/
│       ├── src/
│       │   └── main.nr   # ZK circuit
│       ├── Nargo.toml
│       └── Prover.toml   # Test inputs
│
├── contracts/
│   └── prediction/
│       ├── src/
│       │   ├── lib.rs        # Main contract
│       │   ├── test.rs       # Tests
│       │   └── verification.rs # ZK verifier
│       └── Cargo.toml
│
├── scripts/
│   ├── deploy_testnet.sh     # Deployment
│   └── e2e_test_settle.sh    # E2E test
│
└── web/
    └── src/                  # Next.js frontend (TODO)
```
