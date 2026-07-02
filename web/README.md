# zkPrediction Frontend

Next.js frontend for the Minority Wins Prediction Market.

## Features

- **Wallet Integration**: Connect with Freighter, Albedo, or other Stellar wallets
- **Create Predictions**: Ask questions and set betting parameters
- **Place Bets**: Commit bets privately with hashed commitments
- **Track Bets**: View all your bets and their status
- **ZK Verified**: All settlements are mathematically proven

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd web
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build for Production

```bash
npm run build
```

The build output will be in the `out/` directory.

## Project Structure

```
web/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Main page
│   │   └── globals.css      # Global styles
│   ├── components/          # React components
│   │   ├── Header.tsx       # Navigation header
│   │   ├── PredictionCard.tsx # Prediction display
│   │   ├── BettingModal.tsx # Bet placement modal
│   │   ├── CreatePredictionForm.tsx # Create form
│   │   ├── MyBets.tsx      # User's bets view
│   │   └── Stats.tsx       # Features section
│   ├── lib/                 # Utilities
│   │   ├── contract.ts      # Contract interaction
│   │   ├── wallet.ts        # Wallet integration
│   │   ├── commitment.ts    # Commitment utilities
│   │   ├── store.ts         # State management
│   │   └── abi.ts           # Contract ABI
│   └── types/               # TypeScript types
│       └── index.ts
├── public/                  # Static assets
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Configuration

The contract ID and network are configured in `src/lib/contract.ts`:

```typescript
export const CONTRACT_CONFIG = {
  testnet: 'CDHSVJYDZDCZPEZXOS5A7QGYOYAOEX6MUHJV6M3ZTXMQ5B5PKRWEG7LU',
  mainnet: '', // TODO: Update with deployed contract
};
```

## Wallet Integration

The app uses `@stellar/freighter-api` for wallet connection. Make sure you have the Freighter browser extension installed.

## Tech Stack

- **Next.js 14** - React framework
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Lucide React** - Icons
- **Framer Motion** - Animations (planned)
