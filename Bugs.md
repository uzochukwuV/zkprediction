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
