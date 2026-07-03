import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'zkPrediction',
  description: 'Outcome-based prediction markets with private claims and on-chain settlement.',
  keywords: ['prediction market', 'ZK proofs', 'Stellar', 'Soroban', 'blockchain'],
  openGraph: {
    title: 'zkPrediction',
    description: 'Outcome-based prediction markets with private claims and on-chain settlement.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} min-h-screen bg-dark-300 text-bone-white antialiased font-sans`}>
        {children}
      </body>
    </html>
  );
}
