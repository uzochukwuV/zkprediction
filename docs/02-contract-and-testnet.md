# Smart Contract Privacy And Testnet Flow

This document explains how the Soroban contract was shaped for private outcome-based betting, and how we tested the full lifecycle on testnet.

## Privacy Model

The contract no longer tries to reveal user votes.

Instead:

- users commit to an answer privately
- settlement publishes the winning answer and totals
- the claim proof proves the bettor had the correct hidden commitment

This keeps the vote hidden while still allowing the contract to verify claims.

## Contract Responsibilities

Core contract responsibilities:

- create a prediction market
- accept a commitment for a bet
- close betting
- settle the market with the winning answer
- verify claims against the circuit proof
- expose read methods for the frontend

Relevant files:

- `contracts/prediction/src/lib.rs`
- `contracts/prediction/src/verification.rs`
- `contracts/prediction/src/test.rs`

## Testnet Lifecycle We Ran

The testnet flow we exercised was:

1. deploy the contract
2. create a market
3. commit a bet
4. settle the market
5. prepare and verify a claim proof

The contract ID we ended up using in the working testnet flow was:

- `CC7Y3EYLPK77UYY2SJPMSW57FYKGYSAD2AY2JC5I25ATZUHJHNYGIJXQ`

## What Went Wrong During Testing

### 1. Wrong `vk_hash` Encoding

The deployment initially failed because the contract expected a 32-byte value, not a hex string in the wrong shape.

Error:

- `Expected type bytes32 (exactly 32 bytes)`

Fix:

- pass the verification key hash in the exact bytes format required by Soroban

### 2. Wrong Commitment Encoding

When committing a bet, the contract expected a `bytes32` commitment and the CLI rejected the argument format.

Error:

- `Failed to parse argument 'commitment'`

Fix:

- generate the commitment as a raw 32-byte hash
- pass that exact byte sequence to the contract

### 3. Contract Trap On Invalid Action

We saw `InvalidAction` and `UnreachableCodeReached` when the commit flow did not match the contract’s expected data shape.

Fix:

- align the commit payload with the contract function signature
- ensure the commitment bytes and escrow amount are encoded correctly

### 4. Commitments Looked Like Votes

We learned that the commitment itself should not expose the vote.

Fix:

- commit only the hash
- keep the raw vote and nonce local
- derive the proof later at claim time

## How The Privacy Works

The contract sees:

- market parameters
- bet commitment
- settlement result
- proof bytes at claim time

The contract does not see:

- the raw vote before settlement
- the nonce outside the claim proof path

This is enough for privacy while still enabling on-chain settlement and claim verification.

## Testnet Commands We Used

Examples:

```bash
nargo compile
bb write_vk -b target/prediction_settle.json -o target/vk --verifier_target noir-recursive
bash scripts/deploy_testnet.sh
bash scripts/list_markets.sh
bash scripts/testnet_flow.sh
```

## Lessons Learned

- Keep the contract ABI and the circuit witness schema in lockstep.
- Use explicit bytes32 inputs for hashes and commitments.
- Read methods should be stable enough for the frontend to query markets without mocks.
- Test every step independently before wiring the full frontend.

## Files To Review

- `scripts/deploy_testnet.sh`
- `scripts/list_markets.sh`
- `scripts/testnet_flow.sh`
- `scripts/testnet_claim.sh`
- `contracts/prediction/src/lib.rs`

