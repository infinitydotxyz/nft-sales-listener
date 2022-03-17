import { SaleSource, TokenStandard } from "@infinityxyz/lib/types/core";

export enum BASE_TIME {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export interface PreParsedNftSale {
  chainId: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  collectionAddress: string;
  tokenId: string;
  price: BigInt;
  paymentToken: string;
  buyer: string;
  seller: string;
  quantity: number;
  source: SaleSource;
  tokenStandard: TokenStandard;
}


export interface Stats {
  chainId: string;
  collectionAddress: string;
  tokenId?: string;
  floorPrice: number;
  ceilPrice: number;
  totalVolume: number;
  totalNumSales: number;
  avgPrice: number;
  updatedAt: number;
}
