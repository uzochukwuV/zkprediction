// zkPrediction - Outcome-Based Claim Circuit
//
// Proves that a claimant knows an opening for a Poseidon commitment and that
// their vote matches the admin-revealed winning option.

use dep::poseidon::poseidon::bn254;

global OPTION_A: u32 = 0;
global OPTION_B: u32 = 1;

fn hash2(left: Field, right: Field) -> Field {
    bn254::hash_2([left, right])
}

fn main(
    prediction_id: pub Field,
    slot: pub Field,
    commitment: pub Field,
    winning_option: pub u32,
    vote: u32,
    nonce: Field,
) {
    let expected_commitment = hash2(vote as Field, nonce);
    assert(commitment == expected_commitment, "Commitment mismatch");
    assert(vote == winning_option, "Wrong answer");
    if winning_option == OPTION_A {
        assert(true, "Valid outcome");
    } else {
        assert(winning_option == OPTION_B, "Invalid outcome");
    }
}