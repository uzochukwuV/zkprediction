import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'zkPrediction - Minority Wins Prediction Market',
  description: 'A private prediction market where MINORITY bettors win. Bet on outcomes privately and win big if you predict the overlooked option.',
  keywords: ['prediction market', 'ZK proofs', 'Stellar', 'Soroban', 'minority wins', 'blockchain'],
  openGraph: {
    title: 'zkPrediction - Minority Wins Prediction Market',
    description: 'Bet privately on predictions. The MINORITY wins the entire pool!',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-dark-300">
        {children}
      </body>
    </html>
  );
}
