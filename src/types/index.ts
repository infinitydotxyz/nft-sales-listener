import { TokenStandard } from "@infinityxyz/lib/types/core";

export enum SALE_SOURCE {
  OPENSEA = 'OPENSEA'
}

export enum TOKEN_TYPE {
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155'
}

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
  source: SALE_SOURCE;
  tokenType: TokenStandard;
}

export interface NftSale {
  chainId: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  collectionAddress: string;
  tokenId: string;
  price: number;
  paymentToken: string;
  buyer: string;
  seller: string;
  quantity: number;
  source: SALE_SOURCE;
  tokenType: TokenStandard;
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
