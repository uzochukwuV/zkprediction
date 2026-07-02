//! ZK Verification Module for UltraHonk Proofs
//!
//! This module provides integration with the Nethermind UltraHonk verifier
//! for verifying ZK proofs on Soroban.

use soroban_sdk::{BytesN, Env, Vec};

#[cfg(feature = "nethermind-verifier")]
use ultrahonk_soroban_verifier::UltraHonkVerifier;

#[cfg(not(feature = "nethermind-verifier"))]
pub struct UltraHonkVerifier {
    _env: Env,
}

#[cfg(not(feature = "nethermind-verifier"))]
impl UltraHonkVerifier {
    pub fn new(env: &Env) -> Self {
        Self { _env: env.clone() }
    }

    pub fn verify(
        &self,
        _proof: &BytesN<64>,
        _public_inputs: &BytesN<128>,
        _vk_hash: &BytesN<32>,
    ) -> bool {
        // Stub for when verifier is not enabled
        true
    }
}
