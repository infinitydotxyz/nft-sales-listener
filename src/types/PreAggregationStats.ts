import { Stats } from "@infinityxyz/lib/types/core";


export type PreAggregationStats = Pick<Stats, 'avgPrice' | 'ceilPrice' | 'chainId' | 'collectionAddress' | 'floorPrice' | 'numSales' | 'tokenId' | 'volume' | 'updatedAt'>;