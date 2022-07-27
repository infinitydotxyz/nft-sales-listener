import { ChainNFTs, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
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

export interface PreParsedNftSaleInfo {
  collectionAddress: string;
  tokenId: string;
  price: BigInt;
  buyer: string;
  seller: string;
  quantity: number;
  tokenStandard: TokenStandard;
}

export interface PreParsedMultipleNftSale {
  paymentToken: string;
  chainId: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  source: SaleSource;
  sales: PreParsedNftSaleInfo[];
}

export interface PreParsedInfinityNftSale {
  chainId: string;
  txHash: string;
  transactionIndex: number;
  blockNumber: number;
  timestamp: number;
  complication: string;
  source: SaleSource;
  paymentToken: string;
  price: BigInt;
  buyer: string;
  seller: string;
  quantity: number;
  tokenStandard: TokenStandard;
  orderItems: ChainNFTs[];
}

export interface PreParsedInfinityNftSaleInfo {
  paymentToken: string;
  price: BigInt;
  buyer: string;
  seller: string;
  quantity: number;
  tokenStandard: TokenStandard;
  orderItems: ChainNFTs[];
}

export interface PreParsedInfinityNftSaleInfoMatchOrder extends PreParsedInfinityNftSaleInfo {
  buyOrderHash: string;
  sellOrderHash: string;
}

export interface PreParseInfinityNftSaleInfoTakeOrder extends PreParsedInfinityNftSaleInfo {
  orderHash: string;
}

export interface PreParseInfinityMultipleNftSaleBase {
  chainId: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  complication: string;
  source: SaleSource;
}

export interface PreParseInfinityMultipleNftSaleMatchOrder extends PreParseInfinityMultipleNftSaleBase {
  sales: PreParsedInfinityNftSaleInfoMatchOrder[];
}

export interface PreParseInfinityMultipleNftSaleTakeOrder extends PreParseInfinityMultipleNftSaleBase {
  sales: PreParseInfinityNftSaleInfoTakeOrder[];
}

export type PreParseInfinityMultipleNftSale =
  | PreParseInfinityMultipleNftSaleMatchOrder
  | PreParseInfinityMultipleNftSaleTakeOrder;

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
