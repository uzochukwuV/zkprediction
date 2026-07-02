// zkPrediction - Minority Wins Prediction Market Settlement Circuit

global N: u32 = 16;
global OPTION_A: u32 = 0;
global OPTION_B: u32 = 1;

fn main(
    prediction_id: pub Field,
    pool_token: pub Field,
    commitments: [Field; N],
    winning_option: pub u32,
    minority_option: pub u32,
    minority_count: pub u32,
    total_pool: pub Field,
    minority_total: pub Field,
    reserve_price: pub Field,
    deadline: pub u64,
    choices: [u32; N],
    amounts: [Field; N],
    blindings: [Field; N],
    active: [bool; N]
) {
    let mut count_a: u32 = 0;
    let mut count_b: u32 = 0;
    let mut sum_a: Field = 0;
    let mut sum_b: Field = 0;
    
    for i in 0..N {
        if active[i] {
            let preimage = [choices[i] as Field, amounts[i], blindings[i]];
            let expected_commit = std::hash::pedersen_hash(preimage);
            assert(commitments[i] == expected_commit, "Commitment mismatch");
            if choices[i] == OPTION_A {
                count_a = count_a + 1;
                sum_a = sum_a + amounts[i];
            } else {
                count_b = count_b + 1;
                sum_b = sum_b + amounts[i];
            }
        } else {
            assert(commitments[i] == 0, "Inactive slot has commitment");
        }
    }
    
    let expected_minority = if count_a < count_b { OPTION_A } else { OPTION_B };
    assert(minority_option == expected_minority, "Minority option mismatch");
    let expected_minority_count = if count_a < count_b { count_a } else { count_b };
    assert(minority_count == expected_minority_count, "Minority count mismatch");
    let expected_minority_total = if count_a < count_b { sum_a } else { sum_b };
    assert(minority_total == expected_minority_total, "Minority total mismatch");
    let expected_total = sum_a + sum_b;
    assert(total_pool == expected_total, "Total pool mismatch");
    assert((winning_option == 0) | (winning_option == 1), "Invalid winning option");
    assert(minority_count > 0, "No minority bettors");
}
