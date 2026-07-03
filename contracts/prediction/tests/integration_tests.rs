use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Bytes, Env};

mod prediction_contract {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/prediction.wasm"
    );
}

const VK_BYTES: &[u8] = include_bytes!("../../../circuits/prediction_settle/target/claim/vk/vk");
const PROOF_BYTES: &[u8] =
    include_bytes!("../../../circuits/prediction_settle/target/claim/proof.bin/proof");
const PUBLIC_INPUTS_BYTES: &[u8] =
    include_bytes!("../../../circuits/prediction_settle/target/claim/proof.bin/public_inputs");

fn register_client(env: &Env) -> prediction_contract::Client<'_> {
    let admin = Address::generate(env);
    let pool_token = Address::generate(env);
    let vk_bytes = Bytes::from_slice(env, VK_BYTES);
    let wasm: &[u8] = include_bytes!("../../../target/wasm32v1-none/release/prediction.wasm");
    let contract_id = env.register(wasm, (admin, pool_token, vk_bytes));
    prediction_contract::Client::new(env, &contract_id)
}

#[test]
fn verify_claim_proof_succeeds() {
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    env.ledger().set_protocol_version(26);

    let client = register_client(&env);
    let proof = Bytes::from_slice(&env, PROOF_BYTES);
    let public_inputs = Bytes::from_slice(&env, PUBLIC_INPUTS_BYTES);

    assert!(client.verify_proof(&proof, &public_inputs));
}