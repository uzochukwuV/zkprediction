# Bugs.md

## FIXED: ZK Proof Verification Failure

### Problem
The integration test `verify_claim_proof_succeeds` was failing with an `IndexBounds` error inside the UltraHonk verifier.

### Root Cause
The proof generation was producing invalid proofs. Even `bb verify` failed to verify the proof locally.

### Solution
1. Replaced the placeholder verifier with the real `rs-soroban-ultrahonk` crate from ProofBridge
2. Updated to use Soroban SDK 26.1.0
3. Added VK format compatibility for bb v0.87.0 (handling 1764 byte VKs with extra field)
4. Fixed TOTAL array size in shplemini.rs for proper MSM computation
5. Regenerated the proof with the correct command:
   ```
   bb write_vk -s ultra_honk --oracle_hash keccak -b target/prediction_settle.json -o target/claim/vk
   bb prove -s ultra_honk --oracle_hash keccak --bytecode_path target/prediction_settle.json --witness_path target/prediction_settle.gz --output_path target/claim/proof.bin
   ```

### Current Status
- ✅ `bb verify` passes on the regenerated proof
- ✅ Integration test `verify_claim_proof_succeeds` passes
- ✅ Real BN254 pairing verification is now in use

### Artifacts
- VK: 1760 bytes
- Proof: 14592 bytes  
- Public inputs: 64 bytes

### Key Files Changed
- `contracts/prediction/Cargo.toml` - Uses local verifier crate
- `contracts/prediction/src/verification.rs` - Exports from real verifier
- `contracts/prediction/src/lib.rs` - Uses verifier API
- `yugocabrio-rs-soroban-ultrahonk/crates/ultrahonk-soroban-verifier/` - Real verifier crate
- `circuits/prediction_settle/target/claim/` - Regenerated proof artifacts

---

## KNOWN ISSUE: Testnet Verification Failure

### Problem
When calling `claim_reward` on Stellar testnet, the transaction fails with:
```
VM call trapped: UnreachableCodeReached
```

### Investigation
- ✅ `bb verify` passes locally with the same proof, VK, and public inputs
- ✅ Integration test `verify_claim_proof_succeeds` passes (uses Soroban SDK test environment)
- ❌ Testnet verification fails

### Root Cause Analysis
The error occurs deep inside the UltraHonk verifier when running on Soroban's WASM VM. Possible causes:
1. **WASM VM arithmetic differences** - The Soroban WASM VM may have subtle differences in how it handles field arithmetic
2. **Memory constraints** - The on-chain WASM VM has limited memory for complex MSM computations
3. **Proof format mismatch** - The proof structure may need adjustment for on-chain verification

### Possible Solutions
1. Reduce circuit complexity (smaller CONST_PROOF_SIZE_LOG_N)
2. Implement batch verification to reduce per-verification computation
3. Use a simpler proof system for the claim circuit
4. Debug with on-chain diagnostic events to pinpoint the exact failure location

### Status
**UNDER INVESTIGATION**

---

## FIXED: Testnet WASM VM Incompatibility

### Root Cause

Three issues were causing the `UnreachableCodeReached` error:

1. **Cargo.lock missing git source**: The `ultrahonk_soroban_verifier` dependency was resolving from a stale cached version instead of the git repository.

2. **API mismatch**: The git version of `UltraHonkVerifier::verify()` requires `&Env` as the first argument:
   ```rust
   // Wrong (was):
   verifier.verify(&proof, &public_inputs).is_ok()
   
   // Correct (fixed):
   verifier.verify(env, &proof, &public_inputs).is_ok()
   ```

3. **Public inputs format mismatch**: The contract was passing `prediction_id` as the second public input, but the Noir circuit expects `winning_option`.

### Fixes Applied

1. Changed `contracts/prediction/Cargo.toml` from path dependency to git dependency:
   ```toml
   ultrahonk_soroban_verifier = { git = "https://github.com/yugocabrio/ultrahonk-rust-verifier.git", package = "ultrahonk_soroban_verifier", default-features = false }
   ```

2. Fixed `verify_proof_bytes` in `contracts/prediction/src/lib.rs` to pass `&Env` to `verify()`

3. Fixed `pack_claim_public_inputs` to pass `winning_option` instead of `prediction_id`:
   ```rust
   fn pack_claim_public_inputs(
       env: &Env,
       commitment: BytesN<32>,
       winning_option: u32,
   ) -> Bytes {
       // Circuit expects: [commitment (32 bytes), winning_option (32 bytes)]
       ...
   }
   ```

4. Regenerated `Cargo.lock` with `cargo update` to fetch from git

### Verification

- ✅ Contract builds successfully
- ✅ `create_prediction` works on testnet
- ✅ `close_betting` works on testnet
- ✅ `settle` works on testnet
- ✅ `commit_bet` works on testnet
- ✅ `claim_reward` works on testnet with real ZK proof verification
- ✅ Integration test passes
- ✅ Full flow tested: prediction_id=1, winning_option=0, payout=10000000

### Test Flow
```bash
# Deploy
stellar contract deploy --wasm target/wasm32v1-none/release/prediction.wasm \
  --source testdeploy --network testnet \
  -- --admin $(stellar keys address testdeploy) \
  --vk_bytes-file-path circuits/prediction_settle/target/claim/vk/vk

# Create prediction (id=1)
stellar contract invoke ... create_prediction ...

# Close and settle (winning_option=0)
stellar contract invoke ... close_betting --prediction_id 1
stellar contract invoke ... settle --prediction_id 1 --winning_option 0 --count_a 1 --count_b 0

# Commit bet with matching commitment
stellar contract invoke ... commit_bet ... --commitment 01a4c3379fa3f6d0dc0fb702d88c4506ab603e8022bfbe58e68dbd2505d7abc3

# Claim reward (proof generated with matching commitment and winning_option=0)
stellar contract invoke ... claim_reward --prediction_id 1 --slot 0 --proof <proof_hex>
```

### Reference Repos
- Working verifier: https://github.com/indextree/ultrahonk_soroban_contract
- Original verifier: https://github.com/yugocabrio/ultrahonk-rust-verifier
