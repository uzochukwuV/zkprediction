import { PredictionContract } from '@/lib/contract';
import MarketDetailClient from './MarketDetailClient';

type MarketPageParams = {
  params: {
    id: string;
  };
};

export async function generateStaticParams() {
  const contract = new PredictionContract('testnet');

  try {
    const predictions = await contract.listPredictions();
    return predictions.map((prediction) => ({ id: String(prediction.id) }));
  } catch (error) {
    console.error('Failed to generate market params:', error);
    return [];
  }
}

export default function MarketPage({ params }: MarketPageParams) {
  return <MarketDetailClient marketId={params.id} />;
}