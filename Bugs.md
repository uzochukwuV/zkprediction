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
