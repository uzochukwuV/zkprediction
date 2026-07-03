//! zkPrediction - Outcome-Based Prediction Market Smart Contract
//!
//! MVP flow:
//! - commit_bet stores a sealed commitment and escrows funds
//! - close_betting locks the market after the deadline
//! - settle records the winning answer and final counts
//! - claim_reward verifies a winner proof and pays the claimant

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contractmeta, contracttype,
    token, Address, Bytes, BytesN, Env, String,
};

mod verification;
pub use verification::{UltraHonkVerifier, PROOF_BYTES};

const MAX_BETS: u32 = 16;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    VkHash,
    VkBytes,
    PoolToken,
    PredictionCount,
    Prediction(u64),
    Commitment(u64, u32),
    BetCount(u64),
    TotalPool(u64),
    WinningOption(u64),
    CountA(u64),
    CountB(u64),
    Settled(u64),
    Claimed(u64, u32),
}

contractmeta!(key = "Outcome", val = "Outcome Based Prediction Market v1.0");

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
    pub winning_option: Option<u32>,
    pub count_a: Option<u32>,
    pub count_b: Option<u32>,
    pub creator: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct Commitment {
    pub bettor: Address,
    pub commitment: BytesN<32>,
    pub escrow_amount: i128,
}

#[contract]
pub struct PredictionContract;

#[contractimpl]
impl PredictionContract {
    pub fn __constructor(env: Env, admin: Address, pool_token: Address, vk_bytes: Bytes) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }

        let vk_hash: BytesN<32> = env.crypto().keccak256(&vk_bytes).into();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolToken, &pool_token);
        env.storage().instance().set(&DataKey::VkBytes, &vk_bytes);
        env.storage().instance().set(&DataKey::VkHash, &vk_hash);
        env.storage().instance().set(&DataKey::PredictionCount, &0u64);
    }

    pub fn create_prediction(
        env: Env,
        creator: Address,
        question: String,
        option_a: String,
        option_b: String,
        deadline: u64,
        reserve_price: i128,
    ) -> u64 {
        assert!(deadline > env.ledger().timestamp(), "Deadline must be in future");

        let pool_token: Address = env.storage().instance().get(&DataKey::PoolToken).unwrap();

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
            pool_token,
        };

        let prediction = Prediction {
            id: prediction_id,
            params,
            status: PredictionStatus::Open,
            bet_count: 0,
            total_pool: 0,
            winning_option: None,
            count_a: None,
            count_b: None,
            creator: creator.clone(),
        };

        env.storage().instance().set(&DataKey::Prediction(prediction_id), &prediction);
        env.storage().instance().set(&DataKey::PredictionCount, &prediction_id);
        env.storage().instance().set(&DataKey::BetCount(prediction_id), &0u32);
        env.storage().instance().set(&DataKey::TotalPool(prediction_id), &0i128);

        env.events().publish(("prediction", "created"), (prediction_id, creator, deadline));
        prediction_id
    }

    pub fn commit_bet(
        env: Env,
        bettor: Address,
        prediction_id: u64,
        amount: i128,
        commitment: BytesN<32>,
    ) -> u32 {
        let mut prediction = get_prediction(&env, prediction_id);

        // Transfer tokens from bettor to contract
        let pool_token_address: Address = env.storage().instance().get(&DataKey::PoolToken).unwrap();
        let pool_token = token::Client::new(&env, &pool_token_address);
        
        // Bettor must approve the contract to spend tokens first
        // Then we transfer from bettor to contract
        bettor.require_auth();
        pool_token.transfer(&bettor, &env.current_contract_address(), &amount);

        let slot = prediction.bet_count;
        let commitment_data = Commitment {
            bettor: bettor.clone(),
            commitment,
            escrow_amount: amount,
        };
        env.storage().instance().set(&DataKey::Commitment(prediction_id, slot), &commitment_data);

        prediction.bet_count += 1;
        prediction.total_pool += amount;

        env.storage().instance().set(&DataKey::Prediction(prediction_id), &prediction);
        env.storage().instance().set(&DataKey::BetCount(prediction_id), &prediction.bet_count);
        env.storage().instance().set(&DataKey::TotalPool(prediction_id), &prediction.total_pool);

        env.events().publish(("bet", "committed"), (prediction_id, slot, bettor, amount));
        slot
    }

    pub fn close_betting(env: Env, prediction_id: u64) -> bool {
        // Get existing prediction
        let key = DataKey::Prediction(prediction_id);
        let mut prediction: Prediction = env.storage().instance().get(&key).expect("Prediction not found");

        // Update status
        prediction.status = PredictionStatus::Closed;

        // Store updated prediction
        env.storage().instance().set(&key, &prediction);

        // Emit event
        env.events().publish(("prediction", "closed"), prediction_id);
        true
    }

    pub fn settle(
        env: Env,
        prediction_id: u64,
        winning_option: u32,
        count_a: u32,
        count_b: u32,
    ) -> bool {
        // Get existing prediction
        let key = DataKey::Prediction(prediction_id);
        let mut prediction: Prediction = env.storage().instance().get(&key).expect("Prediction not found");
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Admin not set");

        // Update prediction
        prediction.status = PredictionStatus::Settled;
        prediction.winning_option = Some(winning_option);
        prediction.count_a = Some(count_a);
        prediction.count_b = Some(count_b);

        // Store updated prediction
        env.storage().instance().set(&key, &prediction);

        // Store additional data
        env.storage().instance().set(&DataKey::WinningOption(prediction_id), &winning_option);
        env.storage().instance().set(&DataKey::CountA(prediction_id), &count_a);
        env.storage().instance().set(&DataKey::CountB(prediction_id), &count_b);
        env.storage().instance().set(&DataKey::Settled(prediction_id), &true);

        // Emit event
        env.events().publish(("prediction", "settled"), (prediction_id, winning_option, count_a, count_b, admin));
        true
    }

    pub fn verify_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        let proof_len = proof.len() as usize;
        if proof_len != PROOF_BYTES {
            return false;
        }

        Self::verify_proof_bytes(&env, proof, public_inputs)
    }

    fn verify_proof_bytes(env: &Env, proof: Bytes, public_inputs: Bytes) -> bool {
        let vk_bytes = env
            .storage()
            .instance()
            .get::<_, Bytes>(&DataKey::VkBytes)
            .expect("VK bytes not set");

        let verifier = match UltraHonkVerifier::new(env, &vk_bytes) {
            Ok(verifier) => verifier,
            Err(_) => return false,
        };

        verifier.verify(env, &proof, &public_inputs).is_ok()
    }

    pub fn claim_reward(
        env: Env,
        prediction_id: u64,
        slot: u32,
        proof: Bytes,
    ) -> i128 {
        let prediction = get_prediction(&env, prediction_id);
        assert!(matches!(prediction.status, PredictionStatus::Settled), "Prediction is not settled");
        assert!(env.storage().instance().has(&DataKey::Claimed(prediction_id, slot)) == false, "Already claimed");

        let winning_option = prediction.winning_option.expect("Winning option not set");
        let commitment = env
            .storage()
            .instance()
            .get::<_, Commitment>(&DataKey::Commitment(prediction_id, slot))
            .expect("Commitment not found");

        let public_inputs = Self::pack_claim_public_inputs(
            &env,
            commitment.commitment.clone(),
            winning_option,
        );

        assert!(Self::verify_proof_bytes(&env, proof, public_inputs), "ZK proof verification failed");

        let winning_count = if winning_option == 0 {
            prediction.count_a.expect("Count A not set")
        } else {
            prediction.count_b.expect("Count B not set")
        };
        assert!(winning_count > 0, "No winning bettors");

        let payout = prediction.total_pool / (winning_count as i128);

        // Transfer payout tokens to the winner
        let pool_token_address: Address = env.storage().instance().get(&DataKey::PoolToken).unwrap();
        let pool_token = token::Client::new(&env, &pool_token_address);
        pool_token.transfer(&env.current_contract_address(), &commitment.bettor, &payout);

        env.storage().instance().set(&DataKey::Claimed(prediction_id, slot), &true);
        env.events().publish(("prediction", "claimed"), (prediction_id, slot, commitment.bettor, payout));
        payout
    }

    pub fn get_prediction(env: Env, prediction_id: u64) -> Prediction {
        get_prediction(&env, prediction_id)
    }

    pub fn get_commitment(env: Env, prediction_id: u64, slot: u32) -> Commitment {
        env.storage().instance().get(&DataKey::Commitment(prediction_id, slot)).expect("Commitment not found")
    }

    pub fn get_vk_bytes(env: Env) -> Bytes {
        env.storage().instance().get::<_, Bytes>(&DataKey::VkBytes).expect("VK bytes not set")
    }

    pub fn get_vk_hash(env: Env) -> BytesN<32> {
        env.storage().instance().get::<_, BytesN<32>>(&DataKey::VkHash).expect("VK hash not set")
    }

    pub fn pack_claim_public_inputs_view(
        env: &Env,
        commitment: BytesN<32>,
        winning_option: u32,
    ) -> Bytes {
        Self::pack_claim_public_inputs(env, commitment, winning_option)
    }
}

fn get_prediction(env: &Env, prediction_id: u64) -> Prediction {
    env.storage().instance().get(&DataKey::Prediction(prediction_id)).expect("Prediction not found")
}

impl PredictionContract {
    fn pack_claim_public_inputs(
        env: &Env,
        commitment: BytesN<32>,
        winning_option: u32,
    ) -> Bytes {
        let mut out = Bytes::new(env);
        // Circuit expects: [commitment (32 bytes), winning_option (32 bytes)]
        out.append(&Bytes::from_array(env, &commitment.to_array()));
        Self::append_u64(env, &mut out, winning_option as u64);
        out
    }

    fn append_u64(env: &Env, out: &mut Bytes, value: u64) {
        let mut bytes = [0u8; 32];
        bytes[24..32].copy_from_slice(&value.to_be_bytes());
        out.append(&Bytes::from_array(env, &bytes));
    }

    fn append_u32(env: &Env, out: &mut Bytes, value: u32) {
        let mut bytes = [0u8; 32];
        bytes[28..32].copy_from_slice(&value.to_be_bytes());
        out.append(&Bytes::from_array(env, &bytes));
    }
}

#[cfg(test)]
mod test;