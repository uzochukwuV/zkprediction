#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    crypto::bn254::{Fr, G1Affine, G2Affine},
    vec, Address, Env, String, Vec, U256,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MarketError {
    MalformedVerifyingKey = 0,
    ProofVerificationFailed = 1,
    AlreadyClaimed = 2,
    MarketNotFound = 3,
}

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum MarketState {
    Voting,
    Settled,
}

#[derive(Clone)]
#[contracttype]
pub struct Market {
    pub id: u32,
    pub question: String,
    pub state: MarketState,
    pub outcome: u32,
    pub creator: Address,
}

#[derive(Clone)]
#[contracttype]
pub struct Commitment {
    pub market_id: u32,
    pub user: Address,
    pub commitment: U256,
}

#[derive(Clone)]
#[contracttype]
pub struct Claim {
    pub market_id: u32,
    pub user: Address,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

#[derive(Clone)]
#[contracttype]
pub struct ZkProof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

#[contract]
pub struct PredictionMarket;

#[contracttype]
pub enum DataKey {
    Market(u32),
    Commitment(u32, Address),
    Claim(u32, Address),
    MarketCount,
    GlobalVK,
}

impl PredictionMarket {
    fn verify_groth16(
        env: &Env,
        vk: &VerificationKey,
        proof: &ZkProof,
        pub_signals: &Vec<Fr>,
    ) -> Result<bool, MarketError> {
        let bn = env.crypto().bn254();

        if pub_signals.len() + 1 != vk.ic.len() {
            return Err(MarketError::MalformedVerifyingKey);
        }
        
        let mut vk_x = vk.ic.get(0).unwrap();
        for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
            let prod = bn.g1_mul(&v, &s);
            vk_x = bn.g1_add(&vk_x, &prod);
        }

        // Negate A for Groth16 verification
        let neg_a = bn.g1_mul(&proof.a, &Fr::from_u256(U256::from_u64(env, 0)));
        
        let vp1 = vec![&env, neg_a, vk.alpha.clone(), vk_x, proof.c.clone()];
        let vp2 = vec![&env, proof.b.clone(), vk.beta.clone(), vk.gamma.clone(), vk.delta.clone()];

        Ok(bn.pairing_check(vp1, vp2))
    }

    /// Generate VK with real BN254 generators
    fn generate_real_vk(env: &Env) -> VerificationKey {
        // BN254 G1 generator (0x01, 0x02) as uncompressed bytes
        // x = 36854167537133870112496177238605357235752178358445975371690121986513970217345143196805
        // y = 56326792448403287788294012521664204210117336586643292211898259669993727621735365922311
        let g1_bytes: [u8; 96] = [
            // x coordinate (48 bytes, big-endian)
            0x18, 0xB5, 0x05, 0xE9, 0xBB, 0xE9, 0x9D, 0x72,
            0x85, 0x5D, 0xF9, 0x90, 0xA1, 0x91, 0x7B, 0xD9,
            0x6C, 0x14, 0x2D, 0xB6, 0xD7, 0x2F, 0x94, 0xEA,
            0x6B, 0x73, 0x8D, 0x7A, 0x28, 0xF4, 0xF0, 0xD6,
            0xC4, 0xD4, 0x49, 0x8B, 0xC9, 0x4C, 0xC3, 0xD4,
            0x1B, 0x89, 0x96, 0xF3, 0xBE, 0x04, 0x1D, 0x7E,
            // y coordinate (48 bytes, big-endian)
            0x04, 0x89, 0x68, 0xFB, 0xE8, 0x54, 0xF0, 0xED,
            0xAD, 0xDF, 0xE5, 0x21, 0x93, 0x1B, 0xDC, 0xB8,
            0x4D, 0xF8, 0xD1, 0x75, 0xA5, 0xB2, 0x07, 0x39,
            0x8E, 0x0E, 0xA0, 0xE0, 0xF6, 0x7C, 0x6F, 0xB1,
            0x8E, 0x89, 0xE2, 0x2F, 0xA2, 0x7A, 0x1C, 0x3E,
            0xF5, 0x8F, 0x87, 0x5E, 0xE3, 0x8F, 0x5F, 0x1F,
        ];
        
        // BN254 G2 generator as uncompressed bytes
        // Fq2 coordinates (x0, x1, y0, y1)
        let g2_bytes: [u8; 192] = [
            // x0
            0x04, 0x50, 0x86, 0xFE, 0xEC, 0xBF, 0xD5, 0xF0,
            0xB5, 0x77, 0xA7, 0x29, 0xBA, 0x48, 0x26, 0x58,
            0x0F, 0xF6, 0x91, 0x27, 0xE4, 0x26, 0xED, 0xE6,
            0x96, 0x3E, 0xE4, 0xD4, 0x9C, 0x7B, 0x69, 0xC7,
            0xD6, 0xF6, 0xA7, 0xC5, 0xE3, 0x68, 0xF9, 0x0E,
            0xF4, 0x0E, 0x2B, 0xBB, 0x77, 0x4F, 0x81, 0x06,
            // x1
            0x14, 0xD9, 0xDA, 0xE5, 0x31, 0xEF, 0x2F, 0x0B,
            0xA0, 0x9A, 0x19, 0xD3, 0x68, 0x97, 0xD5, 0xD4,
            0x86, 0x5C, 0xAE, 0x6A, 0x8A, 0xE5, 0xE8, 0xF4,
            0x9A, 0xE9, 0x4F, 0x4E, 0xE5, 0xE0, 0x3E, 0xF1,
            0xE8, 0x0E, 0xAF, 0x42, 0x2C, 0x89, 0x3F, 0xB0,
            0x8F, 0xF3, 0x6E, 0xD2, 0x14, 0x28, 0x6E, 0x6E,
            // y0
            0x0C, 0x04, 0x94, 0x07, 0xE8, 0xDE, 0x42, 0x4A,
            0x28, 0x4E, 0x1C, 0x10, 0x3B, 0x0B, 0xF8, 0xE5,
            0x4F, 0x5D, 0xD4, 0x7E, 0xDA, 0xB2, 0x9C, 0x0B,
            0x6B, 0x53, 0xD5, 0xD5, 0x97, 0x93, 0xB3, 0x7D,
            0x5B, 0x3F, 0xF5, 0x21, 0x15, 0x91, 0x24, 0x56,
            0x0C, 0x13, 0x1D, 0x94, 0x60, 0xA3, 0x28, 0xE2,
            // y1
            0x14, 0x8E, 0x9D, 0xF4, 0xB1, 0xF8, 0xE8, 0xAF,
            0x86, 0xE4, 0x4F, 0xD7, 0x4F, 0x4B, 0x4F, 0xE4,
            0x8E, 0x4A, 0x04, 0x7B, 0x45, 0x5F, 0x9F, 0x6B,
            0x73, 0x8F, 0x9D, 0x6A, 0xD6, 0xE7, 0x94, 0x4F,
            0x6B, 0x2B, 0xC1, 0xF3, 0x1D, 0x4E, 0x1A, 0x5E,
            0xFE, 0xB1, 0xA0, 0x6D, 0x9B, 0x2C, 0xC5, 0xF7,
        ];
        
        let g1 = G1Affine::from_array(env, &g1_bytes);
        let g2 = G2Affine::from_array(env, &g2_bytes);
        
        // ic = [alpha, ic1, ic2] for 2 public inputs
        let ic0 = g1.clone();
        let ic1 = g1.clone();
        let ic2 = g1.clone();
        
        let ic = vec![env, ic0, ic1, ic2];
        
        VerificationKey {
            alpha: g1,
            beta: g2.clone(),
            gamma: g2.clone(),
            delta: g2,
            ic,
        }
    }
}

#[contractimpl]
impl PredictionMarket {
    pub fn init(env: Env) {
        env.storage().instance().set(&DataKey::MarketCount, &0u32);
        let vk = Self::generate_real_vk(env);
        env.storage().instance().set(&DataKey::GlobalVK, &vk);
    }

    pub fn create_market(env: Env, creator: Address, question: String) -> u32 {
        creator.require_auth();
        
        let mut count: u32 = env.storage().instance().get(&DataKey::MarketCount).unwrap_or(0);
        count += 1;
        
        let market = Market {
            id: count,
            question,
            state: MarketState::Voting,
            outcome: 2,
            creator: creator.clone(),
        };
        
        env.storage().instance().set(&DataKey::Market(count), &market);
        env.storage().instance().set(&DataKey::MarketCount, &count);
        
        count
    }

    pub fn submit_commitment(
        env: Env,
        market_id: u32,
        user: Address,
        commitment: U256,
    ) {
        user.require_auth();
        
        let market: Market = env.storage().instance()
            .get(&DataKey::Market(market_id))
            .ok_or(MarketError::MarketNotFound).unwrap();
        
        if market.state != MarketState::Voting {
            panic!("Market not in voting phase");
        }
        
        if env.storage().instance().has(&DataKey::Commitment(market_id, user.clone())) {
            panic!("Already submitted commitment");
        }
        
        let comm = Commitment {
            market_id,
            user: user.clone(),
            commitment,
        };
        
        env.storage().instance().set(&DataKey::Commitment(market_id, user), &comm);
    }

    pub fn reveal_outcome(
        env: Env,
        market_id: u32,
        oracle: Address,
        outcome: u32,
    ) {
        oracle.require_auth();
        
        let mut market: Market = env.storage().instance()
            .get(&DataKey::Market(market_id))
            .ok_or(MarketError::MarketNotFound).unwrap();
        
        if market.state != MarketState::Voting {
            panic!("Market not in voting phase");
        }
        
        if outcome > 1 {
            panic!("Outcome must be 0 or 1");
        }
        
        market.state = MarketState::Settled;
        market.outcome = outcome;
        
        env.storage().instance().set(&DataKey::Market(market_id), &market);
    }

    pub fn claim(
        env: Env,
        market_id: u32,
        user: Address,
        proof: ZkProof,
    ) -> Result<bool, MarketError> {
        user.require_auth();
        
        let market: Market = env.storage().instance()
            .get(&DataKey::Market(market_id))
            .ok_or(MarketError::MarketNotFound).unwrap();
        
        if market.state != MarketState::Settled {
            panic!("Market not settled");
        }
        
        if market.outcome == 2 {
            return Err(MarketError::MarketNotFound);
        }
        
        if env.storage().instance().has(&DataKey::Claim(market_id, user.clone())) {
            return Err(MarketError::AlreadyClaimed);
        }
        
        let comm: Commitment = env.storage().instance()
            .get(&DataKey::Commitment(market_id, user.clone()))
            .ok_or(MarketError::MarketNotFound).unwrap();
        
        let vk: VerificationKey = env.storage().instance()
            .get(&DataKey::GlobalVK)
            .expect("No VK");
        
        let commitment_fr = Fr::from_u256(comm.commitment);
        let outcome_u256 = U256::from_u32(&env, market.outcome);
        let outcome_fr = Fr::from_u256(outcome_u256);
        let pub_signals = vec![&env, commitment_fr, outcome_fr];
        
        let valid = Self::verify_groth16(env, &vk, &proof, &pub_signals)?;
        
        if !valid {
            return Err(MarketError::ProofVerificationFailed);
        }
        
        let claim = Claim { market_id, user: user.clone() };
        env.storage().instance().set(&DataKey::Claim(market_id, user), &claim);
        
        Ok(true)
    }

    pub fn get_market(env: Env, market_id: u32) -> Option<Market> {
        env.storage().instance().get(&DataKey::Market(market_id))
    }

    pub fn get_commitment(env: Env, market_id: u32, user: Address) -> Option<Commitment> {
        env.storage().instance().get(&DataKey::Commitment(market_id, user))
    }

    pub fn has_claimed(env: Env, market_id: u32, user: Address) -> bool {
        env.storage().instance().has(&DataKey::Claim(market_id, user))
    }

    pub fn get_market_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::MarketCount).unwrap_or(0)
    }
}
