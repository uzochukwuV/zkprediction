# Circuit, Noir, and VK Notes

This document captures how the Noir circuit was built, what we installed, how we compiled it, and the mistakes we hit while generating the verification key and proving artifacts.

## Goal

The circuit is the privacy layer for the prediction market claim flow.

The user commits to a vote privately, and later proves that their hidden commitment matches the settled outcome. The contract never needs to learn the raw vote.

## Environment And Installation

We used WSL for Noir and `bb` actions.

Installed tools:

- `nargo 1.0.0-beta.22`
- `bbup` from the Aztec `barretenberg` installer
- compatible `barretenberg` via `bbup`

Commands used:

```bash
nargo --version
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash
source ~/.bashrc
bbup
```

`bbup` resolved the Noir version from `nargo` and installed a matching `barretenberg` build under `~/.bb`.

## Circuit Layout

The circuit lives in:

- `circuits/prediction_settle/src/main.nr`

The intent is:

- accept the public market data
- accept the private witness inputs
- recompute the commitment
- prove the claim is for the winning outcome

The practical lesson: keep the public inputs minimal and put secret vote material only in the witness.

## Compilation Flow

We compiled the circuit with:

```bash
cd circuits/prediction_settle
nargo compile
```

After that we generated the verification key:

```bash
bb write_vk \
  -b target/prediction_settle.json \
  -o target/vk \
  --verifier_target noir-recursive
```

This produced:

- `target/vk/vk`
- `target/vk/vk_hash`

## VK Hash And Stellar Integration

The `vk_hash` is what the Soroban contract uses to bind the on-chain verifier to the exact proving key pair.

We verified the flow by reading the generated hash from:

- `circuits/prediction_settle/target/vk/vk_hash`

and passing the bytes32 value into the contract deployment flow.

Important detail:

- Stellar contract arguments expected exactly 32 raw bytes for `vk_hash`
- passing a hex string with the wrong encoding caused a parse error

## Real Errors We Hit

### 1. Missing `bb`

Before `bbup`, the shell did not know `bb`.

Fix:

- install `bbup`
- source the shell profile
- run `bbup`

### 2. Zero Width No-Break Space At File Start

The Noir file initially had a BOM / zero-width byte at the start.

Error:

- `Unknown start of token: \u{feff}`

Fix:

- remove the BOM
- keep the source file plain UTF-8 without BOM

### 3. Unsupported `&&` In Noir

Noir does not support logical `&&` in the way normal Rust-like code does.

Error:

- `Noir has no logical-and (&&) operator`

Fix:

- replace `&&` with `&` for boolean-style combination
- or split the logic into `if` blocks when short-circuiting is required

### 4. Field Comparison Errors

We initially compared `Field` values directly.

Error:

- `Fields cannot be compared, try casting to an integer first`

Fix:

- cast to integer types before comparison when the circuit requires ordering logic

### 5. Missing Witness Arguments

`nargo execute` / proof generation failed when the witness file did not include every required input.

Examples:

- missing `_deadline`
- missing `active`

Fix:

- keep `Prover.toml` synchronized with the circuit signature
- add every private and public witness field explicitly

### 6. Boolean / Ordering Mismatches In Public Inputs

We also hit cases where the public inputs did not line up with the circuit output shape.

Fix:

- keep one canonical builder for the witness values
- use the same field names in the script, the prover file, and the frontend claim modal

## What We Learned

- Treat the circuit signature as the source of truth.
- Keep witness names stable across `Prover.toml`, proof scripts, and UI generation.
- Build and generate the VK before wiring the contract.
- Use the exact bytes expected by Soroban for `vk_hash`.
- Keep the prover and contract aligned on the same claim inputs.

## Files To Review

- `circuits/prediction_settle/src/main.nr`
- `circuits/prediction_settle/Prover.toml`
- `circuits/prediction_settle/target/vk/vk_hash`
- `scripts/generate_proof_wsl.sh`

