# zkPrediction - Private Prediction Market with Minority Wins

> **Status**: ✅ Fully operational on Stellar Testnet with on-chain ZK proof verification

## Overview

zkPrediction implements a private prediction market where users bet on binary outcomes, but unlike traditional prediction markets where the majority wins, **the minority option carries the reward**. This creates contrarian incentives and rewards those who correctly identify overlooked outcomes.

## Key Achievements

- ✅ **Full testnet deployment** with real token staking
- ✅ **ZK proof verification** executed successfully on-chain
- ✅ **Token rewards claimed** by winners
- ✅ **SAC integration** for token management
- ✅ **Complete end-to-end flow** documented

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
- **ZK Verified**: Settlement correctness proven and verified on-chain using UltraHonk
- **SAC Tokens**: Uses Stellar Asset Contract for efficient token management

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

## System Components

### Smart Contract (Soroban/Stellar)

Located in `contracts/prediction/`:

| File | Purpose |
|------|---------|
| `src/lib.rs` | Main contract with `create_prediction`, `commit_bet`, `settle`, `claim_reward` |
| `src/verification.rs` | ZK proof verification using UltraHonk |
| `src/test.rs` | Unit and integration tests |

**Contract Functions:**
- `create_prediction` - Create a new prediction market
- `commit_bet` - Stake tokens with a commitment (hides choice)
- `close_betting` - Lock the prediction after deadline
- `settle` - Admin sets winning option and counts
- `claim_reward` - Winner claims payout with ZK proof

### ZK Circuit (Noir)

Located in `circuits/prediction_settle/`:

| File | Purpose |
|------|---------|
| `src/main.nr` | Noir circuit proving valid commitment |
| `Nargo.toml` | Noir configuration |
| `Prover.toml` | Test inputs for proof generation |

**Circuit verifies:**
- Commitment matches the revealed choice
- Choice equals the winning option
- No overflow in calculations

### Frontend (Next.js)

Located in `web/`:
- Question creation interface
- Wallet connection (Freighter)
- Betting UI with commitment generation
- Settlement verification display

## How It Works

### 1. Question Setup

```rust
create_prediction(
    creator: Address,
    question: String,
    option_a: String,
    option_b: String,
    deadline: u64,
    reserve_price: i128,
) -> u64
```

### 2. Commit Phase

```rust
commit_bet(
    bettor: Address,
    prediction_id: u64,
    amount: i128,
    commitment: BytesN<32>,  // hash(choice, nonce)
) -> u32  // returns slot index
```

Users:
1. Choose option (0 or 1)
2. Generate random nonce
3. Compute `commitment = hash(choice, nonce)`
4. Lock tokens via `transfer()` (requires `require_auth()`)
5. Store commitment on-chain

### 3. Resolution

Admin calls:
```rust
close_betting(prediction_id: u64)
settle(
    prediction_id: u64,
    winning_option: u32,
    count_a: u32,
    count_b: u32,
)
```

### 4. Claim with ZK Proof

```rust
claim_reward(
    prediction_id: u64,
    slot: u32,
    proof: Bytes,
) -> i128  // returns payout amount
```

Winner generates proof locally showing:
- Their commitment opens to the winning choice
- The commitment matches what's stored on-chain

### 5. Verification & Payout

Contract verifies:
1. ZK proof is valid (using UltraHonk verifier)
2. Commitment matches the revealed value
3. Transfers payout to winner

## Repository Structure

```
zkprediction/
├── contracts/
│   ├── prediction/           # Soroban smart contract
│   │   ├── src/lib.rs       # Main contract logic
│   │   ├── src/verification.rs # ZK verification
│   │   └── Cargo.toml
│   └── token/               # Token wrapper (optional)
├── circuits/
│   └── prediction_settle/     # Noir ZK circuit
│       ├── src/main.nr       # Circuit code
│       └── Nargo.toml
├── web/                     # Frontend
├── Bugs.md                   # Bug tracking & testnet results
├── SKILL.md                  # AI agent skill
└── .agents/skills/          # Loaded Stellar skills
    ├── smart-contracts/
    ├── assets/
    ├── standards/
    └── zk-proofs/
```

## Testnet Deployment

### Contract Addresses (Testnet)

| Component | Address |
|-----------|---------|
| Prediction Contract | `CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7` |
| SAC Token | `CASJ2W5ODS6CXA34RXSXEE4A743NMNQHTPBCFINJXCVNV75VJJNFZZRV` |
| Asset Issuer | `GAO4IFRZOJEDVFDZ4V42PFUEUGMCMMXMPKYNBPEUYEF6DXVP54ZRKTCQ` |

### Build & Deploy

```bash
# Build contract
cargo build --release --target wasm32v1-none -p prediction

# Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/prediction.wasm \
  --source testdeploy --network testnet \
  -- --admin <admin_address> \
  --pool_token CASJ2W5ODS6CXA34RXSXEE4A743NMNQHTPBCFINJXCVNV75VJJNFZZRV \
  --vk_bytes-file-path circuits/prediction_settle/target/claim/vk/vk

# Create prediction
stellar contract invoke --source testdeploy --network testnet \
  --id <contract_id> -- create_prediction \
  --creator <creator_address> \
  --question "Will BTC reach 100k by 2025" \
  --option_a "Yes BTC reaches 100k" \
  --option_b "No BTC stays below 100k" \
  --deadline 9999999999 \
  --reserve_price 10000000

# Commit bet
stellar contract invoke --source bettor1 --network testnet \
  --id <contract_id> -- commit_bet \
  --bettor <bettor_address> \
  --prediction_id 1 \
  --amount 10000000 \
  --commitment <commitment_hex>

# Settle
stellar contract invoke --source testdeploy --network testnet \
  --id <contract_id> -- settle \
  --prediction_id 1 --winning_option 0 --count_a 2 --count_b 0

# Claim reward
stellar contract invoke --source bettor1 --network testnet \
  --id <contract_id> -- claim_reward \
  --prediction_id 1 --slot 0 \
  --proof-file-path circuits/prediction_settle/target/claim/proof.bin/proof
```

### Verified Test Flow

| Step | TX Hash |
|------|---------|
| Prediction Created | `5beae105ed572cc1c56b212a00352cb2cafcc21ddc188a7e93e46d6a76ebf602` |
| Bettor1 Committed | `beed41636595e9461e333824293b611de49cc1422c995ac66c3071796b31bb7f` |
| Bettor2 Committed | `9ea6cef47ad7d311a369e5811344374d15698e6f3563e89d509ccb9721be199c` |
| Betting Closed | `2d8fb26ab09b4750a05e3afa1bde4a0e5f8490df3315b20aa78cf0120dcbf3f9` |
| Settled | `80ad1083204a733b1c93661a22e5ccb7693c6ac9afa20f127b071628f08c1663` |
| Reward Claimed | `e6238d1facad3d6b3b1065f278176919198b55ea52a3d3722c4c7ff72245cb7f` |

**Result**: Bettor1 claimed 10,000,000 TESTCOIN with on-chain ZK proof verification!

## Token Integration

### Using Stellar Asset Contract (SAC)

SAC is recommended for production tokens:

```bash
# Deploy SAC for existing classic asset
stellar contract asset deploy \
  --asset USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN \
  --source alice --network testnet

# Create trustline
stellar contract invoke --source bettor --network testnet \
  --id <sac_address> -- trust --addr <bettor_address>

# Approve (if using transfer_from pattern)
stellar contract invoke --source bettor --network testnet \
  --id <sac_address> -- approve \
  --from <bettor_address> \
  --spender <contract_address> \
  --amount 100000000 \
  --expiration_ledger 3500000
```

### Commitment Generation

```rust
// Commitment = hash(choice || nonce)
// In practice, use Poseidon hash from Noir circuit

let commitment: BytesN<32> = env.crypto().keccak256(
    &(choice.to_be_bytes(), nonce.to_be_bytes()).into()
);
```

## Security Properties

| Property | How It's Achieved |
|----------|-------------------|
| **Privacy** | Commitments hide choices until settlement |
| **Correctness** | ZK proof verifies calculation on-chain |
| **Liveness** | On-chain execution ensures settlement |
| **Fairness** | Smart contract enforces minority distribution |
| **No Front-running** | Commitments sealed until after deadline |
| **Authorization** | `require_auth()` prevents unauthorized transfers |

## Technical Details

### SDK & Dependencies

- **Soroban SDK**: 26.1.0
- **ZK Verifier**: `ultrahonk_soroban_verifier` from git
- **Proof System**: UltraHonk (Barretenberg)
- **Network**: Stellar Testnet (Protocol 27)

### Important Notes

1. **Deadline must be in future** - Use timestamps like `9999999999`
2. **Trustlines required** - Bettors need trustlines for the token
3. **Use `--proof-file-path`** - Pass proof as file, not hex
4. **SAC recommended** - Has working `approve` unlike custom tokens

## Development Skills

This project includes loaded AI agent skills for Stellar development:

```
.agents/skills/
├── smart-contracts/   # Soroban contract development
├── assets/           # Classic assets & SAC
├── standards/        # SEPs, CAPs, ecosystem
└── zk-proofs/       # ZK verification patterns
```

## License

MIT

## Links

- [Original zkAuction](https://github.com/oliva9595/zkauction)
- [Stellar Developers](https://developers.stellar.org)
- [Soroban SDK](https://docs.rs/soroban-sdk)
- [Noir Language](https://noir-lang.org/)
- [UltraHonk Verifier](https://github.com/yugocabrio/ultrahonk-rust-verifier)
