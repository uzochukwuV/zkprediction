# zkPrediction - Private Prediction Market with Minority Wins

## Overview

zkPrediction implements a private prediction market where users bet on binary outcomes, but unlike traditional prediction markets where the majority wins, **the minority option carries the reward**. This creates contrarian incentives and rewards those who correctly identify overlooked outcomes.

## The Minority Wins Concept

In a standard prediction market:
- Users bet on outcomes (e.g., Yes/No)
- If outcome A wins, all bettors on A share the pot from losers
- Majority bettors win

In **zkPrediction** (Minority Wins):
- Users bet on outcomes (e.g., Yes/No)
- If outcome A wins, only bettors who chose the **minority option (B)** receive rewards
- Minority bettors win the pot from majority losers
- This rewards contrarian thinking and correct identification of overlooked outcomes

## Key Features

- **Private Bets**: Bids/positions stay hidden until resolution via ZK proofs
- **Minority Rewards**: Only users who bet on the minority outcome receive rewards
- **On-Chain Settlement**: No trusted intermediary - contract enforces rules
- **ZK Verified**: Settlement correctness proven and verified on-chain

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Minority Wins Prediction Market              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────────┐   │
│  │  User A  │     │  User B  │     │       User C          │   │
│  │  Bets:   │     │  Bets:   │     │       Bets:           │   │
│  │  Option1 │     │  Option2 │     │       Option1         │   │
│  │  (100)   │     │  (50)    │     │       (200)           │   │
│  └────┬─────┘     └────┬─────┘     └──────────┬───────────┘   │
│       │                │                      │                │
│       └────────────────┼──────────────────────┘                │
│                        │                                       │
│                        ▼                                       │
│              ┌─────────────────┐                              │
│              │  Commit Phase    │                              │
│              │  (Private Bids)  │                              │
│              └────────┬────────┘                              │
│                       │                                        │
│                       ▼                                        │
│              ┌─────────────────┐                              │
│              │  Resolution     │                              │
│              │  (Oracle/Event) │                              │
│              └────────┬────────┘                              │
│                       │                                        │
│        ┌──────────────┼──────────────┐                        │
│        │              │              │                        │
│        ▼              ▼              ▼                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐               │
│  │ Option1  │  │  Total Pool  │  │ Option2  │               │
│  │ Total:   │  │    350       │  │ Total:   │               │
│  │   300    │  │  Majority    │  │   50     │               │
│  └──────────┘  └──────────────┘  └──────────┘               │
│       │                                         │               │
│       │         Minority (Wins All!)            │               │
│       └─────────────────────────────────────────┘               │
│                        │                                        │
│                        ▼                                        │
│              ┌─────────────────┐                                │
│              │   Settlement    │                                │
│              │  User B gets:   │                                │
│              │  350 (all pool) │                                │
│              │  7x return!     │                                │
│              └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Question Setup

The question creator specifies:
- The question (e.g., "Will X happen by date Y?")
- Two options (e.g., "Yes" / "No")
- Resolution criteria
- Deadline for betting
- Pool token (typically XLM or a community token)

### 2. Commit Phase

Users commit to their prediction:
1. Choose an option (Option A or Option B)
2. Lock their bet amount in escrow
3. Submit a cryptographic commitment: `hash(choice, blinding_factor, amount)`
4. The actual choice and amount remain private

### 3. Resolution

After the deadline:
1. An oracle or event determines the winning outcome
2. The market resolves to either Option A or Option B

### 4. Settlement (ZK Verified)

The magic happens here:
1. **Count total bets on each option**
2. **Identify the minority option** (fewer total bets)
3. **Distribute entire pool to minority bettors** (proportional to their bet)
4. **Majority bettors lose everything**

Example:
- Pool: 350 tokens
- Option A: 300 tokens (majority - 3 bettors)
- Option B: 50 tokens (minority - 1 bettor)
- Result: Option A wins
- **Winner**: The 1 bettor on Option B receives all 350 tokens!
- **Return**: 7x their original bet

### 5. Verification

A ZK circuit proves:
- The commitment openings are valid
- The counts are correct
- The distribution is mathematically correct
- No cheating or manipulation

## System Components

### Smart Contract (Soroban)

Handles:
- Creating prediction questions
- Accepting sealed bet commitments
- Escrowing user funds
- Closing betting phase
- Verifying ZK proof
- Distributing rewards to minority winners

### ZK Circuit (Noir)

Proves:
- All commitments open correctly
- The minority option is correctly identified
- The distribution calculation is correct
- No overflow or underflow in arithmetic

### Web Interface

Provides:
- Question creation interface
- Wallet connection (Freighter)
- Betting UI
- Real-time odds display
- Settlement verification

## Repository Structure

```
zkprediction/
├── circuits/
│   └── prediction_settle/
│       ├── src/main.nr       # ZK circuit
│       ├── Nargo.toml        # Noir config
│       └── Prover.toml       # Test inputs
├── contracts/
│   └── prediction/
│       ├── src/lib.rs        # Soroban contract
│       ├── src/test.rs       # Tests
│       └── Cargo.toml        # Rust config
├── scripts/
│   ├── deploy_testnet.sh     # Deployment
│   └── e2e_test_settle.sh   # E2E test
└── web/
    └── src/                  # Next.js frontend
```

## Security Properties

| Property | How It's Achieved |
|----------|-------------------|
| **Privacy** | Commitments hide choices until settlement |
| **Correctness** | ZK proof verifies calculation |
| **Liveness** | On-chain execution ensures settlement |
| **Fairness** | Smart contract enforces minority distribution |
| **No Front-running** | Commitments are sealed until after deadline |
| **Anti-Collusion** | Individual bet amounts are hidden |

## Deployment

### Prerequisites

- Rust & Cargo
- Stellar CLI
- Nargo (Noir compiler)
- Barretenberg (Proof system)

### Build Contract

```bash
stellar contract build --manifest-path contracts/prediction/Cargo.toml
```

### Build Circuit

```bash
nargo compile --program-dir circuits/prediction_settle
```

### Generate Verification Key

```bash
bb write_vk -b circuits/prediction_settle/target/prediction_settle.json \
    -o circuits/prediction_settle/target/vk \
    --verifier_target noir-recursive
```

### Deploy

```bash
stellar contract deploy \
    --wasm contracts/prediction/target/wasm32v1-none/release/prediction.wasm \
    --source deployer \
    --network testnet
```

## Usage Example

### Create a Prediction

```javascript
const question = "Will Bitcoin exceed $100,000 by Dec 31, 2025?";
const options = ["Yes", "No"];
const deadline = 1735689600; // Unix timestamp
const reservePrice = 0; // No minimum bet requirement

await contract.create_prediction({
    question,
    options,
    deadline,
    token: nativeToken
});
```

### Place a Bet

```javascript
// User chooses "No" and bets 100 tokens
const choice = 1; // 0 = Yes, 1 = No
const amount = 100_0000000; // 100 tokens with 7 decimals
const blindingFactor = generateBlindingFactor();

const commitment = hash(choice, blindingFactor, amount);

await contract.commit_bet({
    prediction_id: 1,
    commitment,
    escrow_amount: amount
});
```

### Resolve & Settle

```javascript
// Oracle reveals result: "Yes" won
await contract.resolve({ prediction_id: 1, winning_option: 0 });

// Generate ZK proof (off-chain)
// Call settle with proof

await contract.settle({
    prediction_id: 1,
    proof: proofBytes,
    minority_option: 1, // "No" was minority
    minority_count: 1,
    total_pool: 350_0000000
});
```

## FAQ

### Why would anyone bet on the majority?

Sometimes you have high confidence. But the minority reward structure means:
- Betting on minority = higher potential reward
- Betting on majority = safer but lower reward
- This creates interesting market dynamics

### What's the optimal strategy?

There's no guaranteed strategy. If you think 60% of people will bet on "Yes", betting on "No" gives you leverage over the pool. But if you're wrong, you lose everything.

### How does the ZK proof protect privacy?

The circuit proves you placed a valid bet without revealing:
- Your exact bet amount
- Which option you chose
- Your identity (only commitment is public)

### What if no one bets on one option?

If one option has zero bets, it's trivially the minority. The entire pool goes to... nobody! This creates an edge case that should be handled (e.g., minimum bet requirements).

## License

MIT

## Links

- Original zkAuction: https://github.com/oliva9595/zkauction
