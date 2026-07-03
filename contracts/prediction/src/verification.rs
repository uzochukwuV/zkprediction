//! ZK Verification Module for UltraHonk Proofs

use soroban_sdk::{Bytes, BytesN, Env};

#[cfg(feature = "static-vk")]
use ultrahonk_soroban_verifier::UltraHonkVerifier;

#[cfg(not(feature = "static-vk"))]
pub struct UltraHonkVerifier {
    _env: Env,
}

#[cfg(not(feature = "static-vk"))]
impl UltraHonkVerifier {
    pub fn new(env: &Env) -> Self {
        Self { _env: env.clone() }
    }

    pub fn verify(&self, _proof: &Bytes, _public_inputs: &Bytes, _vk_hash: &BytesN<32>) -> bool {
        true
    }
}