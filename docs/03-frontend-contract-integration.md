# Frontend Contract Integration

This document explains how the React frontend talks to the Soroban contract, how it loads live markets, and how we handled the issues that showed up during integration.

## What The Frontend Does

The frontend is responsible for:

- loading all markets from the chain
- rendering market cards
- creating a prediction market
- placing a bet
- opening the claim flow
- preparing proof inputs for the circuit
- calling contract methods through the wallet

Key files:

- `web/src/lib/contract.ts`
- `web/src/lib/store.ts`
- `web/src/app/page.tsx`
- `web/src/components/BettingModal.tsx`
- `web/src/components/ClaimRewardModal.tsx`
- `web/src/components/MyBets.tsx`

## Contract Wrapper

The core integration lives in:

- `web/src/lib/contract.ts`

That wrapper now:

- resolves the contract ID and network config
- builds Soroban invoke arguments
- uses Freighter for signing writes
- uses a null source account for read-only simulation
- normalizes the contract output into the UI shape

Important read method:

- `listPredictions()`

This method first tries the contract’s count getter, then falls back to probing market IDs sequentially.

## Normalization Fixes

The contract returned snake_case data and enum-like status objects, while the UI expected camelCase and string statuses.

We normalized:

- `option_a` -> `optionA`
- `option_b` -> `optionB`
- `pool_token` -> `poolToken`
- `reserve_price` -> `reservePrice`
- `{ tag: 'Open' }` -> `'Open'`

This is why the market list now renders the real chain data correctly.

## BigInt Persistence Fix

We hit a browser persistence crash:

- `TypeError: Do not know how to serialize a BigInt`

Root cause:

- Zustand persisted the user bets store directly to localStorage
- `amount` was a `bigint`

Fix:

- use `createJSONStorage`
- serialize `bigint` to string on save
- revive it back to `bigint` on load

Relevant file:

- `web/src/lib/store.ts`

## Read-Only Queries Without Wallet

Market browsing should not require a connected wallet.

To make that work, the read path uses a null source account for simulation instead of forcing wallet access.

This keeps:

- browse mode wallet-free
- write actions wallet-signed

## Claim Flow

The claim modal:

- builds claim proof inputs
- shows the Prover.toml-style witness data
- accepts the generated proof bytes
- sends the claim to the contract

Relevant file:

- `web/src/components/ClaimRewardModal.tsx`

## UI Flow We Wired

Page flow:

1. load markets from the contract on mount
2. render the market list
3. open bet modal on selection
4. commit the bet on-chain
5. persist the bet locally for claim tracking
6. show claim modal after settlement

Relevant file:

- `web/src/app/page.tsx`

## Errors We Hit And Fixed

### 1. Missing Markets In UI

Cause:

- the frontend expected a different contract response shape

Fix:

- normalize the contract data before storing it in Zustand

### 2. Wallet Required For Reads

Cause:

- read-only calls still asked for the connected address

Fix:

- use a null account for `send: false` calls

### 3. BigInt Serialization Crash

Cause:

- localStorage cannot JSON serialize `bigint`

Fix:

- stringify on persist
- revive to `bigint` on load

### 4. Type Errors From Hydrated Bet Values

Cause:

- persisted bets could hydrate as widened types

Fix:

- coerce `predictionId`, `choice`, `slot`, and `amount` to the expected types at the UI boundary

## What To Keep Stable

- the contract ID in `web/src/lib/store.ts`
- the normalization helpers in `web/src/lib/contract.ts`
- the claim proof builder inputs in `ClaimRewardModal`
- the bet persistence format in `useUserBetsStore`

## Result

The frontend can now:

- fetch all markets
- render live contract data
- place bets
- persist bet state safely
- prepare claims from the stored commitment and slot

