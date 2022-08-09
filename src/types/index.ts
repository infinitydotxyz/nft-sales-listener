import { ChainId, ChainNFTs, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
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
  protocolFeeBPS: number;
  protocolFeeWei: string;
  buyer: string;
  seller: string;
  quantity: number;
  tokenStandard: TokenStandard;
  orderItems: ChainNFTs[];
}

export interface PreParsedInfinityNftSaleInfo {
  paymentToken: string;
  price: BigInt;
  protocolFeeBPS: number;
  protocolFeeWei: string;
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

export enum StakeDuration {
  None = 'NONE',
  ThreeMonths = 'THREE_MONTHS',
  SixMonths = 'SIX_MONTHS',
  TwelveMonths = 'TWELVE_MONTHS'
}

export enum StakerEventType {
  RageQuit = 'RAGE_QUIT',
  Staked = 'STAKED',
  UnStaked = 'UN_STAKED'
}

export interface StakerEvent {
  user: string;
  amount: string;
  blockNumber: number;
  timestamp: number;
  txHash: string;
  discriminator: StakerEventType;
  stakerContractAddress: string;
  chainId: ChainId;
}

export interface TokensUnStakedEvent extends StakerEvent {
  discriminator: StakerEventType.UnStaked;
}

export interface RageQuitEvent extends StakerEvent {
  penaltyAmount: string;
  discriminator: StakerEventType.RageQuit;
}

export interface TokensStakedEvent extends StakerEvent {
  duration: StakeDuration;
  discriminator: StakerEventType.Staked;
}

export type StakerEvents = TokensUnStakedEvent | RageQuitEvent | TokensStakedEvent;
