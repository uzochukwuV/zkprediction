# UltraHonk Verifier Integration

This document explains how the real UltraHonk verifier was integrated into the Soroban contract, how the verification key is stored, and how the proof flow is executed during claims.

## What We Built

We replaced the mock verifier path with the real Soroban UltraHonk backend pattern:

- the contract constructor receives raw verification key bytes
- the verification key bytes are stored in contract state
- the contract loads the stored VK bytes at claim time
- the contract constructs `UltraHonkVerifier::new(&env, &vk_bytes)`
- the contract calls `verifier.verify(&env, &proof_bytes, &public_inputs)`

That gives us a real on-chain verification path instead of a hash check or placeholder acceptance path.

## Where The Logic Lives

Key files:

- `contracts/prediction/src/lib.rs`
- `contracts/prediction/src/verification.rs`
- `contracts/prediction/Cargo.toml`
- `scripts/deploy_testnet.sh`
- `scripts/testnet_claim.sh`
- `scripts/generate_proof_wsl.sh`

## Contract Shape

The important contract methods are:

- `__constructor(env, admin, vk_bytes)`
- `verify_proof(env, proof, public_inputs)`
- `claim_reward(env, prediction_id, slot, proof)`

### Constructor

The constructor now stores two values:

- `VkBytes` as immutable contract state
- `VkHash` derived from `env.crypto().keccak256(&vk_bytes)` for auditability

That means deployment now uses the raw VK, not just a hash.

### Proof Verification

`verify_proof(...)` does the following:

1. checks proof length against `PROOF_BYTES`
2. loads the stored VK bytes from contract storage
3. builds the verifier with `UltraHonkVerifier::new(&env, &vk_bytes)`
4. verifies the proof against the public inputs
5. returns `true` or `false`

### Claim Flow

`claim_reward(...)` does not trust a user claim directly.

It:

1. loads the prediction
2. loads the commitment for the claim slot
3. reconstructs the public inputs used by the circuit
4. calls `verify_proof(...)`
5. only then computes the payout

## Proof and Public Inputs

The circuit in `circuits/prediction_settle/src/main.nr` proves:

- the claimant knows the opening for the commitment
- the revealed vote matches the winning option

The witness file is produced from `Prover.toml`, then the proof is generated with Barretenberg.

Relevant script flow:

- `scripts/generate_proof_wsl.sh`
- output proof file: `circuits/prediction_settle/target/claim/proof.bin/proof`
- output hex proof file: `circuits/prediction_settle/target/claim/proof.hex`

## Testnet Deployment

`deploy_testnet.sh` now deploys the contract with VK bytes:

- `--vk_bytes-file-path <path to vk>`

It also saves deployment metadata to `.deployment.json`:

- `contract_id`
- `vk_hash`
- `vk_bytes_path`
- `wasm_hash`

That keeps the deployment reproducible and makes it obvious which VK was used.

## Why The Verifier Crate Needed Patching

The cloned UltraHonk verifier repo expected to be built inside its original workspace.

The local repo is not that workspace, so the manifests had to be flattened:

- `yugocabrio-rs-soroban-ultrahonk/crates/ultrahonk-soroban-verifier/Cargo.toml`
- `yugocabrio-rs-soroban-ultrahonk/crates/test-utils/Cargo.toml`

We replaced `workspace = true` dependency references with explicit `soroban-sdk` versions so the contract could compile inside this project.

## Build Result

After the verifier integration and manifest fix, the contract built successfully with the real verifier path enabled.

## Claim Invoke Notes

The other steps worked:

- deploy
- create market
- commit bet
- settle

The remaining fragile step is `claim_reward`.

Important points for the claim invoke:

- it only takes `prediction_id`, `slot`, and `proof`
- it does not take a separate public-input argument because the contract reconstructs those internally
- the proof must come from the same `Prover.toml` inputs that matched the commitment and settlement values
- the `slot` must match the commitment slot stored on-chain
- the proof hex must be the exact hex output from `scripts/generate_proof_wsl.sh`

If the invoke traps while the earlier steps work, the usual causes are:

- proof generated from the wrong witness values
- wrong `prediction_id` or `slot`
- commitment mismatch between the circuit and on-chain storage
- stale `Prover.toml` from a previous market

## Known Limitation

`claim_reward` currently verifies the proof and computes payout, but it does not yet transfer escrowed tokens.

That was intentional so we could finish the real verification path first.

## Practical Debug Flow

When claim verification fails:

1. regenerate `Prover.toml` from the live market values
2. rerun `scripts/generate_proof_wsl.sh`
3. read back the commitment with `get_commitment`
4. confirm the slot and `prediction_id`
5. retry `scripts/testnet_claim.sh`

## Summary

We now have a real UltraHonk verification path on Soroban:

- VK bytes are stored on-chain
- proof verification is done by the real verifier backend
- claim verification is bound to the on-chain commitment and market outcome
- the deploy and claim scripts are wired for the new flow

The only remaining work is tightening the claim invocation path and adding escrow/token transfer once the verification flow is fully locked down.