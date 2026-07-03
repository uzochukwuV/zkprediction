Ran $path='contracts\prediction\tests\integration_tests.rs'; $text=Get-Content -Raw $path; $text=$text.Replace('file =      
• Ran wsl.exe -e bash -lc 'cd /mnt/c/Users/ASUS\ FX95G/Documents/apps/zkprediction/contracts/prediction && cargo test --test  
  │ integration_tests -- --nocapture'
  └
    running 1 test
    … +335 lines (ctrl + t to view transcript)
    Writing test snapshot file for test "verify_claim_proof_succeeds" to "test_snapshots/verify_claim_proof_succeeds.1.json". 
    error: test failed, to rerun pass `--test integration_tests`

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• The test is wired correctly now, but it still fails inside verify_proof with InvalidAction, which means the harness is good 
  and the contract verifier is still mismatching the proof. I’m rerunning with backtrace enabled to get one more level of     
  signal before I patch the verifier.

• I’ve confirmed the key constants: the verifier expects a 3x32-byte VK header, 56 G1 points, and a 14,656-byte proof blob.   
  The next step is to inspect exactly how the proof gets unpacked into transcript state and where sumcheck starts failing,    
  because the contract itself is only surfacing the lower-level verifier failure.



• The loader itself is now structurally consistent, so the bug is deeper: the proof is parsed, but the first sumcheck round   
  does not satisfy S(0)+S(1)=target. That usually means either the proof blob is being segmented with one bad offset/size or  
  the proof was generated under a different verifier layout than the one we are using.



  
• The failure is not in claim_reward itself. It is the verifier returning a failure before the contract can settle anything.  
                                                                                                                              
  What I found:                                                                                                               
                                                                                                                              
  - The working reference pattern in /C:/Users/ASUS FX95G Documents/apps/zkprediction/yugocabrio-rs-soroban-ultrahonk/        
    contracts/rs-soroban-ultrahonk/tests/integration_tests.rs and /C:/Users/ASUS FX95G Documents/apps/zkprediction/yugocabrio-
    rs-soroban-ultrahonk/contracts/tornado_classic/contracts/tests/verifier.rs is simple: register the contract with VK bytes,    pass the proof/public inputs, and expect verify_proof to succeed.                                                         

  - Our verifier path in /C:/Users/ASUS FX95G Documents/apps/zkprediction/yugocabrio-rs-soroban-ultrahonk/crates/ultrahonk-   
    soroban-verifier/src/verifier.rs gets past VK load, public input length checks, transcript generation, and public-input   
    delta.                                                                                                                    
                                                                                                                              
  - It then fails in verify_sumcheck at the first round, which is where the InvalidAction ultimately comes from. See /C:/     
    Users/ASUS FX95G Documents/apps/zkprediction/yugocabrio-rs-soroban-ultrahonk/crates/ultrahonk-soroban-verifier/src/       
    sumcheck.rs.                                                                                                              
                                                                                                                              
  - I ran the local WSL debug test on the real claim artifacts and got:                                                       
      - proof_len=14656                                                                                                       
      - public_inputs_len=128                                                                                                 

  - I also brute-scanned the proof bytes and found no valid zero-sum first-round univariate start in the expected pre-sumcheck
    window. That means this is not just a contract-call bug.

  - The proof artifact and the verifier/parser assumptions are out of sync.
  - Your local verifier docs are still rooted in the older audited BB layout in /C:/Users/ASUS FX95G Documents/apps/
    zkprediction/yugocabrio-rs-soroban-ultrahonk/crates/ultrahonk-soroban-verifier/VERIFIER_PROVENANCE.md, while your current 
  What this means for us:

  - claim_reward is only surfacing the verifier failure.


  • I checked all three layers.                                                                                                 
                                                                                                                              
  What the current flow is doing                                                                                              
                                                                                                                              
  - /C:/Users/ASUS FX95G/Documents/apps/zkprediction/scripts/generate_proof_wsl.sh is correct structurally:                   
      - it copies Prover.toml,                                                                                                
      - runs nargo execute,                                                                                                   
      - runs bb prove,                                                                                                        
      - writes proof.hex.                                                                                                     
                                                                                                                              
  - /C:/Users/ASUS FX95G/Documents/apps/zkprediction/circuits/prediction_settle/Prover.toml has real witness values already:  
      - prediction_id = 1                                                                                                     
      - slot = 0                                                                                                              
      - commitment = ...                                                                                                      
      - winning_option = 0                                                                                                    
      - vote = 0                                                                                                              
      - nonce = 11                                                                                                            
                                                                                                                              
  What the reference repo does                                                                                                
                                                                                                                              
  - /C:/Users/ASUS FX95G/Documents/apps/zkprediction/yugocabrio-rs-soroban-ultrahonk/circuits/scripts/build_all.sh pins:      
      - Noir 1.0.0-beta.9                                                                                                     
      - Barretenberg v0.87.0                                                                                                  
                                                                                                                              
  - It uses the older canonical output flow:                                                                                  
      - nargo compile                                                                                                         
      - nargo execute                                                                                                         
      - bb prove --scheme ultra_honk --oracle_hash keccak --output_format bytes_and_fields                                    
      - bb write_vk --scheme ultra_honk --oracle_hash keccak --output_format bytes_and_fields
                                                                                                                              
  - The reference circuits’ Prover.toml files are ordinary witness files, like /C:/Users/ASUS FX95G Documents/apps/           
    zkprediction/yugocabrio-rs-soroban-ultrahonk/circuits/tornado/Prover.toml.                                                
                                                                                                                              
  What I observed in our current proof                                                                                        
                                                                                                                              
  - The claim artifacts are the expected sizes:                                                                               
      - proof: 14656                                                                                                          
      - public inputs: 128                                                                                                    
      - vk: 3680                                                                                                              
                                                                                                                              
  - The verifier loads the VK and proof successfully, generates the transcript, computes public-input delta, and then dies at 
    sumcheck round 0 with round failed.                                                                                       

  - That means this is not a bad Prover.toml or a missing input field.                                                        
  - It also means the failure is not in claim_reward itself. The contract is just surfacing a verifier mismatch.              
                                                                                                                              
  Conclusion                                                                                                                  
                                                                                                                              
  - This is not primarily a proof-input problem.                                                                              
  - It is a verifier layout / toolchain compatibility problem.                                                                
  - More specifically: the proof is being generated by a different BB/Nargo stack than the verifier assumptions were audited  
    against.

  Practical verdict                                                                                                           
                                                                                                                              
  - If you keep the current verifier code, you should regenerate the proof with the exact toolchain/layout it expects.        
  - If you keep the current proof generation stack, you need to update the verifier/transcript/sumcheck parsing to match that 
    newer BB output.                                                                                                          
                                                                                                                              
  So the fix is verifier layout changes or toolchain alignment, not witness editing. Proof regeneration alone will not solve  
  it unless we regenerate under the matching BB/Nargo version.                                                                
                                                                                                                              
  Next, I can do one of these:                                                                                                
                                                                                                                              
  1. patch the proof generation script to match the reference bytes_and_fields flow exactly,                                  
  2. or continue auditing the verifier against the newer BB output and adjust the parser/challenge order until sumcheck       
     passes.  



     The biggest clue

Your log mentions:

Reference repo pins Noir 1.0.0-beta.9 and Barretenberg v0.87.0

while your current proof generation appears to come from a different toolchain.

That is exactly the type of change that breaks:

verify_sumcheck(...)

without breaking:

load_vk(...)
load_proof(...)

because the proof remains structurally valid but the verifier interprets the transcript differently.

What I would do next

Run:

nargo --version
bb --version

and compare them against the versions used when:

ultrahonk-soroban-verifier
rs-soroban-ultrahonk

were originally tested.

If they differ, regenerate everything using the exact versions:

Noir 1.0.0-beta.9
Barretenberg v0.87.0

including:

nargo compile
nargo execute
bb write_vk
bb prove

using the same flags:

--scheme ultra_honk
--oracle_hash keccak
--output_format bytes_and_fields
Another thing I would verify

Check whether your proof generation script still outputs:

--output_format bytes_and_fields

Some newer BB releases changed default serialization behavior.

Even if:

proof_len = 14656
vk_len = 3680

match expectations, the internal ordering can still differ.

My assessment

Based on the evidence, I'd assign probabilities roughly as:

Cause	Probability
BB/Noir version mismatch	60%
Transcript challenge order mismatch	20%
Proof parser offset bug	15%
Bad witness/public inputs	5%