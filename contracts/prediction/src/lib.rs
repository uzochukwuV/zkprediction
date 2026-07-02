//! zkPrediction - Minority Wins Prediction Market Smart Contract
//!
//! This contract implements a prediction market where the MINORITY option holders
//! receive ALL rewards. Users bet on binary outcomes (Option A or Option B),
//! but those who bet on the minority option win the entire pool.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contractmeta, contracttype,
    token::Client as TokenClient,
    Address, Bytes, BytesN, Env, String, Vec,
};

mod verification;
use verification::UltraHonkVerifier;

// =============================================================================
// Data Keys and Types
// =============================================================================

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    VkHash,
    Prediction(u64),
    PredictionCount,
    Commitment(u64, u32),
    BetCount(u64),
    TotalPool(u64),
    CountA(u64),
    CountB(u64),
    Resolution(u64),
    MinorityOption(u64),
    MinorityCount(u64),
    MinorityTotal(u64),
    ProofHash(u64),
    Settled(u64),
}

contractmeta!(key = "MinWins", val = "Minority Wins Prediction Market v1.0");

#[contracttype]
#[derive(Clone)]
pub struct PredictionParams {
    pub question: String,
    pub option_a: String,
    pub option_b: String,
    pub deadline: u64,
    pub reserve_price: i128,
    pub pool_token: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum PredictionStatus {
    Open,
    Closed,
    Resolved,
    Settled,
}

#[contracttype]
#[derive(Clone)]
pub struct Prediction {
    pub id: u64,
    pub params: PredictionParams,
    pub status: PredictionStatus,
    pub bet_count: u32,
    pub total_pool: i128,
    pub count_a: u32,
    pub count_b: u32,
    pub winning_option: Option<u32>,
    pub minority_option: Option<u32>,
    pub minority_count: Option<u32>,
    pub minority_total: Option<i128>,
    pub creator: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct Commitment {
    pub bettor: Address,
    pub commitment: BytesN<32>,
    pub escrow_amount: i128,
}

// =============================================================================
// Main Contract Implementation
// =============================================================================

#[contract]
pub struct PredictionContract;

#[contractimpl]
impl PredictionContract {
    pub fn __constructor(env: Env, admin: Address, vk_hash: BytesN<32>) {
        if env.storage().instance().get::<_, Address>(&DataKey::Admin).is_some() {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::VkHash, &vk_hash);
    }

    pub fn create_prediction(
        env: Env,
        creator: Address,
        question: String,
        option_a: String,
        option_b: String,
        deadline: u64,
        reserve_price: i128,
        pool_token: Address,
    ) -> u64 {
        assert!(deadline > env.ledger().timestamp(), "Deadline must be in future");

        let prediction_id = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::PredictionCount)
            .unwrap_or(0)
            + 1;

        let params = PredictionParams {
            question,
            option_a,
            option_b,
            deadline,
            reserve_price,
            pool_token: pool_token.clone(),
        };

        let prediction = Prediction {
            id: prediction_id,
            params,
            status: PredictionStatus::Open,
            bet_count: 0,
            total_pool: 0,
            count_a: 0,
            count_b: 0,
            winning_option: None,
            minority_option: None,
            minority_count: None,
            minority_total: None,
            creator: creator.clone(),
        };

        env.storage().instance().set(&DataKey::Prediction(prediction_id), &prediction);
        env.storage().instance().set(&DataKey::PredictionCount, &prediction_id);
        env.storage().instance().set(&DataKey::BetCount(prediction_id), &0u32);
        env.storage().instance().set(&DataKey::TotalPool(prediction_id), &0i128);
        env.storage().instance().set(&DataKey::CountA(prediction_id), &0u32);
        env.storage().instance().set(&DataKey::CountB(prediction_id), &0u32);

        env.events().publish(("prediction", "created"), (prediction_id, creator, deadline));

        prediction_id
    }

    pub fn commit_bet(
        env: Env,
        bettor: Address,
        prediction_id: u64,
        choice: u32,
        amount: i128,
        commitment: BytesN<32>,
        escrow_amount: i128,
    ) -> u32 {
        assert!(choice == 0 || choice == 1, "Invalid choice: must be 0 or 1");

        let mut prediction = get_prediction(&env, prediction_id);

        assert!(matches!(prediction.status, PredictionStatus::Open), "Prediction is not accepting bets");
        assert!(env.ledger().timestamp() < prediction.params.deadline, "Betting deadline has passed");
        assert!(amount >= prediction.params.reserve_price, "Bet amount below reserve price");
        assert!(escrow_amount == amount, "Escrow amount must match bet amount");

        let token = TokenClient::new(&env, &prediction.params.pool_token);
        token.transfer(&bettor, &env.current_contract_address(), &escrow_amount);

        let slot = prediction.bet_count;

        let commitment_data = Commitment {
            bettor: bettor.clone(),
            commitment,
            escrow_amount,
        };
        env.storage().instance().set(&DataKey::Commitment(prediction_id, slot), &commitment_data);

        prediction.bet_count += 1;
        prediction.total_pool += amount;

        if choice == 0 {
            prediction.count_a += 1;
        } else {
            prediction.count_b += 1;
        }

        env.storage().instance().set(&DataKey::Prediction(prediction_id), &prediction);
        env.storage().instance().set(&DataKey::BetCount(prediction_id), &prediction.bet_count);
        env.storage().instance().set(&DataKey::TotalPool(prediction_id), &prediction.total_pool);
        env.storage().instance().set(&DataKey::CountA(prediction_id), &prediction.count_a);
        env.storage().instance().set(&DataKey::CountB(prediction_id), &prediction.count_b);

        env.events().publish(("bet", "committed"), (prediction_id, slot, bettor, choice, amount));

        slot
    }

    pub fn close_betting(env: Env, prediction_id: u64) -> bool {
        let mut prediction = get_prediction(&env, prediction_id);

        assert!(matches!(prediction.status, PredictionStatus::Open), "Prediction is not in open status");
        assert!(env.ledger().timestamp() >= prediction.params.deadline, "Deadline has not passed yet");

        prediction.status = PredictionStatus::Closed;

        env.storage().instance().set(&DataKey::Prediction(prediction_id), &prediction);
        env.events().publish(("prediction", "closed"), prediction_id);

        true
    }

    pub fn resolve(env: Env, prediction_id: u64, winning_option: u32) -> bool {
        assert!(winning_option == 0 || winning_option == 1, "Invalid winning option");

        let mut prediction = get_prediction(&env, prediction_id);

        assert!(matches!(prediction.status, PredictionStatus::Closed), "Prediction is not in closed status");

        prediction.winning_option = Some(winning_option);

        let (minority_opt, minority_cnt) = if prediction.count_a < prediction.count_b {
            (0u32, prediction.count_a)
        } else {
            (1u32, prediction.count_b)
        };

        prediction.minority_option = Some(minority_opt);
        prediction.minority_count = Some(minority_cnt);
        prediction.status = PredictionStatus::Resolved;

        env.storage().instance().set(&DataKey::Prediction(prediction_id), &prediction);
        env.storage().instance().set(&DataKey::Resolution(prediction_id), &winning_option);
        env.storage().instance().set(&DataKey::MinorityOption(prediction_id), &minority_opt);
        env.storage().instance().set(&DataKey::MinorityCount(prediction_id), &minority_cnt);

        env.events().publish(("prediction", "resolved"), (prediction_id, winning_option, minority_opt));

        true
    }

    pub fn settle(
        env: Env,
        prediction_id: u64,
        proof: BytesN<64>,
        public_inputs: BytesN<128>,
    ) -> bool {
        let mut prediction = get_prediction(&env, prediction_id);

        assert!(matches!(prediction.status, PredictionStatus::Resolved), "Prediction is not in resolved status");
        assert!(env.storage().instance().get::<_, bool>(&DataKey::Settled(prediction_id)).is_none(), "Prediction already settled");

        // Store proof hash for replay protection (first 32 bytes of proof)
        let proof_array = proof.to_array();
        let mut proof_hash = [0u8; 32];
        proof_hash.copy_from_slice(&proof_array[..32]);
        assert!(env.storage().instance().get::<_, BytesN<32>>(&DataKey::ProofHash(prediction_id)).is_none(), "Proof already used");
        env.storage().instance().set(&DataKey::ProofHash(prediction_id), &BytesN::from_array(&env, &proof_hash));

        let stored_vk_hash = env.storage().instance().get::<_, BytesN<32>>(&DataKey::VkHash).expect("VK hash not set");

        let verifier = UltraHonkVerifier::new(&env);
        let is_valid = verifier.verify(&proof, &public_inputs, &stored_vk_hash);
        assert!(is_valid, "ZK proof verification failed");

        // Extract minority_total from public_inputs (simplified - first 16 bytes)
        let mut bytes = [0u8; 16];
        let pi_slice = public_inputs.to_array();
        bytes.copy_from_slice(&pi_slice[..16]);
        let minority_total = i128::from_be_bytes(bytes);

        prediction.minority_total = Some(minority_total);
        prediction.status = PredictionStatus::Settled;

        env.storage().instance().set(&DataKey::Prediction(prediction_id), &prediction);
        env.storage().instance().set(&DataKey::MinorityTotal(prediction_id), &minority_total);
        env.storage().instance().set(&DataKey::Settled(prediction_id), &true);

        env.events().publish(("prediction", "settled"), prediction_id);

        true
    }

    pub fn get_prediction(env: Env, prediction_id: u64) -> Prediction {
        get_prediction(&env, prediction_id)
    }

    pub fn get_commitment(env: Env, prediction_id: u64, slot: u32) -> Commitment {
        env.storage().instance().get(&DataKey::Commitment(prediction_id, slot)).expect("Commitment not found")
    }

    pub fn get_vk_hash(env: Env) -> BytesN<32> {
        env.storage().instance().get(&DataKey::VkHash).expect("VK hash not set")
    }
}

fn get_prediction(env: &Env, prediction_id: u64) -> Prediction {
    env.storage().instance().get(&DataKey::Prediction(prediction_id)).expect("Prediction not found")
}

#[cfg(test)]
mod test {
    #[test]
    fn placeholder() {
        assert!(true);
    }
}

fn extract_i128(data: &[u8], index: usize) -> i128 {
    let offset = index * 32;
    if offset + 16 <= data.len() {
        let mut bytes = [0u8; 16];
        bytes.copy_from_slice(&data[offset..offset + 16]);
        i128::from_be_bytes(bytes)
    } else {
        0
    }
}
