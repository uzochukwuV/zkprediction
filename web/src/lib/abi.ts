// Prediction Contract ABI
// Auto-generated from contracts/prediction/src/lib.rs

export const predictionAbi = [
  {
    name: '__constructor',
    inputs: [
      { name: 'admin', type: 'address' },
      { name: 'vk_hash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'create_prediction',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'question', type: 'string' },
      { name: 'option_a', type: 'string' },
      { name: 'option_b', type: 'string' },
      { name: 'deadline', type: 'u64' },
      { name: 'reserve_price', type: 'i128' },
      { name: 'pool_token', type: 'address' },
    ],
    outputs: [{ name: 'prediction_id', type: 'u64' }],
  },
  {
    name: 'commit_bet',
    inputs: [
      { name: 'bettor', type: 'address' },
      { name: 'prediction_id', type: 'u64' },
      { name: 'amount', type: 'i128' },
      { name: 'commitment', type: 'bytes32' },
      { name: 'escrow_amount', type: 'i128' },
    ],
    outputs: [{ name: 'slot', type: 'u32' }],
  },
  {
    name: 'close_betting',
    inputs: [{ name: 'prediction_id', type: 'u64' }],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'settle',
    inputs: [
      { name: 'prediction_id', type: 'u64' },
      { name: 'winning_option', type: 'u32' },
      { name: 'count_a', type: 'u32' },
      { name: 'count_b', type: 'u32' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'claim_reward',
    inputs: [
      { name: 'prediction_id', type: 'u64' },
      { name: 'slot', type: 'u32' },
      { name: 'proof', type: 'bytes' },
    ],
    outputs: [{ name: 'payout', type: 'i128' }],
  },
  {
    name: 'get_prediction',
    inputs: [{ name: 'prediction_id', type: 'u64' }],
    outputs: [
      {
        name: 'prediction',
        type: 'tuple',
        components: [
          { name: 'id', type: 'u64' },
          { name: 'params', type: 'tuple' },
          { name: 'status', type: 'u32' },
          { name: 'bet_count', type: 'u32' },
          { name: 'total_pool', type: 'i128' },
          { name: 'winning_option', type: 'u32' },
          { name: 'count_a', type: 'u32' },
          { name: 'count_b', type: 'u32' },
          { name: 'creator', type: 'address' },
        ],
      },
    ],
  },
  {
    name: 'get_commitment',
    inputs: [
      { name: 'prediction_id', type: 'u64' },
      { name: 'slot', type: 'u32' },
    ],
    outputs: [
      {
        name: 'commitment',
        type: 'tuple',
        components: [
          { name: 'bettor', type: 'address' },
          { name: 'commitment', type: 'bytes32' },
          { name: 'escrow_amount', type: 'i128' },
        ],
      },
    ],
  },
  {
    name: 'get_vk_hash',
    inputs: [],
    outputs: [{ name: 'vk_hash', type: 'bytes32' }],
  },
  {
    name: 'get_prediction_count',
    inputs: [],
    outputs: [{ name: 'count', type: 'u64' }],
  },
] as const;

export type PredictionFunctionName = typeof predictionAbi[number]['name'];