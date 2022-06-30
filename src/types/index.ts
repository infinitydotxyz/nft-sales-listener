import { SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
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

export interface SeaportSoldNft {
  tokenAddress: string;
  tokenId: string;
  seller: string;
  buyer: string;
}

export interface SeaportReceivedAmount {
  tokenAddress: string;
  amount: string;
  seller: string;
  buyer: string;
}
