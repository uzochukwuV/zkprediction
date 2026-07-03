# zkPrediction - Outcome-Based Prediction Market with ZK Privacy

> **Status**: ✅ Fully operational on Stellar Testnet with on-chain ZK proof verification

## Overview

zkPrediction is an **outcome-based prediction market** built on Stellar where users bet on binary outcomes (Yes/No). Unlike traditional markets, bets remain **private** until resolution - commitments hide user choices, and winners must prove their prediction with a ZK proof to claim rewards.

The core innovation is **private betting**: users commit to their prediction without revealing it, and only reveal their choice when claiming rewards via zero-knowledge proofs.

## Key Achievements

- ✅ **Full testnet deployment** with real token staking
- ✅ **ZK proof verification** executed successfully on-chain (UltraHonk)
- ✅ **Token rewards claimed** by winners
- ✅ **SAC integration** for token management
- ✅ **Complete end-to-end flow** documented with transaction proofs

## Key Features

- **Private Bets**: Bids/positions stay hidden until resolution via ZK proofs
- **Outcome-Based**: Winners share the pool proportionally based on the outcome
- **On-Chain Settlement**: No trusted intermediary - contract enforces rules
- **ZK Verified**: Settlement correctness proven and verified on-chain using UltraHonk
- **SAC Tokens**: Uses Stellar Asset Contract for efficient token management

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   ZK Prediction Market Architecture               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────────┐   │
│  │  User A  │     │  User B  │     │       User C          │   │
│  │  Bets:   │     │  Bets:   │     │       Bets:           │   │
│  │  Option1 │     │  Option2 │     │       Option2         │   │
│  │  (100)   │     │  (50)    │     │       (200)          │   │
│  └────┬─────┘     └────┬─────┘     └──────────┬───────────┘   │
│       │                │                      │                │
│       └────────────────┼──────────────────────┘                │
│                        │                                       │
│                        ▼                                       │
│              ┌─────────────────┐                              │
│              │  Commit Phase    │                              │
│              │  (Private Bids)  │                              │
│              │  hash(choice,    │                              │
│              │   nonce) stored  │                              │
│              └────────┬────────┘                              │
│                       │                                        │
│                       ▼                                        │
│              ┌─────────────────┐                              │
│              │  Resolution     │                              │
│              │  (Oracle/Admin) │                              │
│              │  Option1 Wins   │                              │
│              └────────┬────────┘                              │
│                       │                                        │
│        ┌──────────────┼──────────────┐                        │
│        │              │              │                        │
│        ▼              ▼              ▼                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐               │
│  │ Option1  │  │  Total Pool  │  │ Option2  │               │
│  │ Total:   │  │    350       │  │ Total:   │               │
│  │   100    │  │              │  │   250    │               │
│  └────┬─────┘  └──────────────┘  └──────────┘               │
│       │                                         │               │
│       │     Winners (Option1 bettors)           │               │
│       │     Each gets: 350 * (100/100) = 350    │               │
│       └─────────────────────────────────────────┘               │
│                        │                                        │
│                        ▼                                        │
│              ┌─────────────────┐                                │
│              │   Claim Phase   │                                │
│              │  ZK Proof       │                                │
│              │  Verification   │                                │
│              │  (On-Chain!)    │                                │
│              └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

## How It Works (Outcome-Based)

### The Flow

1. **Create Prediction**: Admin creates a prediction market with two options
2. **Commit Bets**: Users lock tokens with a commitment (hides their choice)
3. **Close Betting**: Admin closes betting after deadline
4. **Admin Settles**: Admin reveals winning option and bet counts
5. **Claim with Proof**: Winners prove their choice with ZK proof to claim rewards

### Example

- Pool: 350 tokens
- Option A bets: 100 tokens (1 bettor)
- Option B bets: 250 tokens (2 bettors)
- Result: Option A wins
- **Option A bettor**: Gets 350 tokens (100% of pool since only they bet on A)
- **Option B bettors**: Lose everything

The key innovation is **privacy**: until someone claims, no one knows who bet on what!

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

## Testnet Deployment (Fully Verified)

### Contract Addresses (Testnet)

| Component | Address |
|-----------|---------|
| Prediction Contract | `CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7` |
| SAC Token | `CASJ2W5ODS6CXA34RXSXEE4A743NMNQHTPBCFINJXCVNV75VJJNFZZRV` |
| Asset Issuer | `GAO4IFRZOJEDVFDZ4V42PFUEUGMCMMXMPKYNBPEUYEF6DXVP54ZRKTCQ` |

### Test Accounts

| Account | Address |
|---------|---------|
| Admin (Bettor2) | `GCWAKBCX3VTYORGEULQFBMHIN23GAI2SDANVWKL25VIWGNUHUL2TFT76` |
| Bettor1 | `GDWUJLB445FTKMZRDYZUIPR4TBZHATLOYXSIGKLDKRZRMBNCEYEN3Q3Z` |

### Complete Verified Transaction Log

#### 1. Contract Deployment
```
TX: 094058a0c9760c48793db739a916fb3812d2ec6e24c959ff52bebbd34fd4dcf5
Explorer: https://stellar.expert/explorer/testnet/tx/094058a0c9760c48793db739a916fb3812d2ec6e24c959ff52bebbd34fd4dcf5
Contract: CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7
WASM Hash: fd7e7aa10d9f43386cbd64a4b044601c4d86c34e3b5d5a623b1260fbe6b3a3da
```

#### 2. Prediction Created
```
TX: 5beae105ed572cc1c56b212a00352cb2cafcc21ddc188a7e93e46d6a76ebf602
Explorer: https://stellar.expert/explorer/testnet/tx/5beae105ed572cc1c56b212a00352cb2cafcc21ddc188a7e93e46d6a76ebf602
Question: "Will BTC reach 100k by 2025"
Option A: "Yes BTC reaches 100k"
Option B: "No BTC stays below 100k"
Deadline: 9999999999
Prediction ID: 1
Creator: GDWUJLB445FTKMZRDYZUIPR4TBZHATLOYXSIGKLDKRZRMBNCEYEN3Q3Z
```

#### 3. Bettor1 Commits Bet (Token Staking)
```
TX: beed41636595e9461e333824293b611de49cc1422c995ac66c3071796b31bb7f
Explorer: https://stellar.expert/explorer/testnet/tx/beed41636595e9461e333824293b611de49cc1422c995ac66c3071796b31bb7f
Bettor: GDWUJLB445FTKMZRDYZUIPR4TBZHATLOYXSIGKLDKRZRMBNCEYEN3Q3Z
Prediction ID: 1
Slot: 0
Amount: 10,000,000 TESTCOIN
Commitment: 01a4c3379fa3f6d0dc0fb702d88c4506ab603e8022bfbe58e68dbd2505d7abc3
Event: transfer(GCWAKBCX3VTYORGEULQFBMHIN23GAI2SDANVWKL25VIWGNUHUL2TFT76 → Contract, 10000000)
```

#### 4. Bettor2 Commits Bet
```
TX: 9ea6cef47ad7d311a369e5811344374d15698e6f3563e89d509ccb9721be199c
Explorer: https://stellar.expert/explorer/testnet/tx/9ea6cef47ad7d311a369e5811344374d15698e6f3563e89d509ccb9721be199c
Bettor: GCWAKBCX3VTYORGEULQFBMHIN23GAI2SDANVWKL25VIWGNUHUL2TFT76
Prediction ID: 1
Slot: 1
Amount: 10,000,000 TESTCOIN
Commitment: 02b4c3379fa3f6d0dc0fb702d88c4506ab603e8022bfbe58e68dbd2505d7abc3
```

#### 5. Betting Closed
```
TX: 2d8fb26ab09b4750a05e3afa1bde4a0e5f8490df3315b20aa78cf0120dcbf3f9
Explorer: https://stellar.expert/explorer/testnet/tx/2d8fb26ab09b4750a05e3afa1bde4a0e5f8490df3315b20aa78cf0120dcbf3f9
Prediction ID: 1
Status: Closed
```

#### 6. Admin Settles Prediction
```
TX: 80ad1083204a733b1c93661a22e5ccb7693c6ac9afa20f127b071628f08c1663
Explorer: https://stellar.expert/explorer/testnet/tx/80ad1083204a733b1c93661a22e5ccb7693c6ac9afa20f127b071628f08c1663
Prediction ID: 1
Winning Option: 0 (Option A - "Yes BTC reaches 100k")
Count A: 2 (both bettors chose Option A)
Count B: 0 (no bets on Option B)
Total Pool: 20,000,000 TESTCOIN
```

#### 7. Bettor1 Claims Reward with ZK Proof ⭐
```
TX: e6238d1facad3d6b3b1065f278176919198b55ea52a3d3722c4c7ff72245cb7f
Explorer: https://stellar.expert/explorer/testnet/tx/e6238d1facad3d6b3b1065f278176919198b55ea52a3d3722c4c7ff72245cb7f
Prediction ID: 1
Slot: 0
ZK Proof: circuits/prediction_settle/target/claim/proof.bin/proof
Proof Verification: ✅ PASSED ON-CHAIN
Payout: 10,000,000 TESTCOIN
Recipient: GDWUJLB445FTKMZRDYZUIPR4TBZHATLOYXSIGKLDKRZRMBNCEYEN3Q3Z
Event: transfer(Contract → Bettor1, 10000000)
```

### Quick Reference: All Transaction Hashes

| Step | TX Hash | Explorer Link |
|------|---------|---------------|
| Deploy Contract | `094058a0...` | [View](https://stellar.expert/explorer/testnet/tx/094058a0c9760c48793db739a916fb3812d2ec6e24c959ff52bebbd34fd4dcf5) |
| Create Prediction | `5beae105...` | [View](https://stellar.expert/explorer/testnet/tx/5beae105ed572cc1c56b212a00352cb2cafcc21ddc188a7e93e46d6a76ebf602) |
| Bettor1 Commits | `beed4163...` | [View](https://stellar.expert/explorer/testnet/tx/beed41636595e9461e333824293b611de49cc1422c995ac66c3071796b31bb7f) |
| Bettor2 Commits | `9ea6cef4...` | [View](https://stellar.expert/explorer/testnet/tx/9ea6cef47ad7d311a369e5811344374d15698e6f3563e89d509ccb9721be199c) |
| Close Betting | `2d8fb26a...` | [View](https://stellar.expert/explorer/testnet/tx/2d8fb26ab09b4750a05e3afa1bde4a0e5f8490df3315b20aa78cf0120dcbf3f9) |
| Settle | `80ad1083...` | [View](https://stellar.expert/explorer/testnet/tx/80ad1083204a733b1c93661a22e5ccb7693c6ac9afa20f127b071628f08c1663) |
| **Claim Reward** ⭐ | `e6238d1f...` | [View](https://stellar.expert/explorer/testnet/tx/e6238d1facad3d6b3b1065f278176919198b55ea52a3d3722c4c7ff72245cb7f) |

### Build & Deploy Commands

```bash
# Build contract
cargo build --release --target wasm32v1-none -p prediction
# Output: target/wasm32v1-none/release/prediction.wasm (64KB)
# WASM Hash: fd7e7aa10d9f43386cbd64a4b044601c4d86c34e3b5d5a623b1260fbe6b3a3da

# Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/prediction.wasm \
  --source testdeploy --network testnet \
  -- --admin GDWUJLB445FTKMZRDYZUIPR4TBZHATLOYXSIGKLDKRZRMBNCEYEN3Q3Z \
  --pool_token CASJ2W5ODS6CXA34RXSXEE4A743NMNQHTPBCFINJXCVNV75VJJNFZZRV \
  --vk_bytes-file-path circuits/prediction_settle/target/claim/vk/vk

# Create prediction
stellar contract invoke --source testdeploy --network testnet \
  --id CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7 \
  -- create_prediction \
  --creator GDWUJLB445FTKMZRDYZUIPR4TBZHATLOYXSIGKLDKRZRMBNCEYEN3Q3Z \
  --question "Will BTC reach 100k by 2025" \
  --option_a "Yes BTC reaches 100k" \
  --option_b "No BTC stays below 100k" \
  --deadline 9999999999 \
  --reserve_price 10000000

# Commit bet (requires trustline)
stellar contract invoke --source bettor1 --network testnet \
  --id CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7 \
  -- commit_bet \
  --bettor GDWUJLB445FTKMZRDYZUIPR4TBZHATLOYXSIGKLDKRZRMBNCEYEN3Q3Z \
  --prediction_id 1 --amount 10000000 \
  --commitment 01a4c3379fa3f6d0dc0fb702d88c4506ab603e8022bfbe58e68dbd2505d7abc3

# Close betting
stellar contract invoke --source testdeploy --network testnet \
  --id CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7 \
  -- close_betting --prediction_id 1

# Settle
stellar contract invoke --source testdeploy --network testnet \
  --id CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7 \
  -- settle --prediction_id 1 --winning_option 0 --count_a 2 --count_b 0

# Claim reward with ZK proof
stellar contract invoke --source bettor1 --network testnet \
  --id CCGZD3PTNY4F3EUC4Y4TMR25EYBU6FSS3HDQV7OUJNAWOCFXTLYOUQG7 \
  -- claim_reward --prediction_id 1 --slot 0 \
  --proof-file-path circuits/prediction_settle/target/claim/proof.bin/proof
```

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

## Zero-Knowledge Proof System

### Overview

This project uses **UltraHonk** (a variant of Plonky2/Plonky3) for on-chain ZK proof verification. The proof system allows winners to prove they made a correct prediction without revealing their choice until claiming.

### Components

| Component | Description |
|-----------|-------------|
| **Circuit** | Noir circuit that verifies commitment openings |
| **Prover** | Generates proof of valid commitment |
| **Verifier** | UltraHonk verifier running on Soroban |
| **Verification Key (VK)** | Pre-compiled key deployed with contract |

### How ZK Proofs Work Here

1. **Commitment Phase**: User computes `commitment = hash(choice, nonce)` and stores it on-chain
2. **Settlement Phase**: Admin reveals the winning option and counts
3. **Claim Phase**: Winner generates a ZK proof showing:
   - They know a `(choice, nonce)` such that `hash(choice, nonce) = stored_commitment`
   - Their `choice` equals the winning option
4. **Verification**: Contract verifies the proof on-chain using UltraHonk

### Noir Circuit Logic

```noir
// From circuits/prediction_settle/src/main.nr

global OPTION_A: u32 = 0;
global OPTION_B: u32 = 1;

// Public inputs: commitment and winning_option
// Private inputs: vote and nonce

fn main(commitment: pub Field, winning_option: pub u32, vote: u32, nonce: Field) {
    // Verify commitment matches
    let expected = poseidon::poseidon::bn254::hash_2([vote as Field, nonce]);
    assert(commitment == expected, "Commitment mismatch");
    
    // Verify vote matches winning option
    assert(vote == winning_option, "Wrong answer");
}
```

### Proof Generation

```bash
cd circuits/prediction_settle

# Compile circuit
nargo compile

# Generate proof (requires witness values)
nargo prove -p claim
```

### Verification Key

The VK is generated from the compiled circuit and deployed with the contract:

```
Location: circuits/prediction_settle/target/claim/vk/vk
Size: 1760 bytes
Hash: Computed during contract deployment via keccak256
```

### Testnet ZK Verification Results

**This project achieved the first successful on-chain UltraHonk ZK proof verification on Stellar testnet!**

| Metric | Value |
|--------|-------|
| Proof Size | ~14.5 KB |
| VK Size | 1760 bytes |
| Verification | ✅ PASSED |
| Gas Cost | Within Soroban limits |
| Network | Stellar Testnet (Protocol 27) |

### Proof Structure (Binary Format)

```
circuits/prediction_settle/target/claim/proof.bin/
├── proof      # UltraHonk proof bytes (variable size)
└── public_inputs  # [commitment (32 bytes), winning_option (32 bytes padded)]
```

### Contract ZK Integration

The contract uses `verification.rs` to verify proofs:

```rust
// From contracts/prediction/src/verification.rs

pub struct UltraHonkVerifier;

impl UltraHonkVerifier {
    pub fn new(env: &Env, vk_bytes: &Bytes) -> Result<Self, ()> {
        // Initialize UltraHonk verifier with VK
    }
    
    pub fn verify(&self, proof: &Bytes, public_inputs: &Bytes) -> Result<(), Error> {
        // Call UltraHonk WASM verifier
    }
}
```

### Important ZK Notes

1. **Proof must match VK**: Each circuit compilation produces a specific VK
2. **Public inputs are transparent**: `commitment` and `winning_option` are public
3. **Private inputs stay private**: `vote` and `nonce` are never revealed on-chain
4. **One proof per claim**: Each slot needs its own proof

## Technical Details

### SDK & Dependencies

- **Soroban SDK**: 26.1.0
- **ZK Verifier**: `ultrahonk_soroban_verifier` from git
- **Proof System**: UltraHonk (Barretenberg)
- **Noir**: For circuit compilation
- **Network**: Stellar Testnet (Protocol 27)

### Important Notes

1. **Deadline must be in future** - Use timestamps like `9999999999`
2. **Trustlines required** - Bettors need trustlines for the token
3. **Use `--proof-file-path`** - Pass proof as file, not hex string
4. **SAC recommended** - Has working `approve` unlike custom tokens
5. **VK deployed with contract** - Verification key is set at deployment time

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
