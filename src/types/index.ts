export enum SCRAPER_SOURCE {
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
export interface NftTransaction {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  price: BigInt;
  paymentToken: string;
  buyerAddress: string;
  sellerAddress: string;
  collectionAddr: string;
  tokenIdStr: string;
  quantity: number;
  source: SCRAPER_SOURCE;
  tokenType: TOKEN_TYPE;
}

export interface NftSalesRepository {
  txHash: string;
  tokenId: string;
  collectionAddress: string;
  price: number;
  paymentTokenType: string;
  quantity: number;
  buyer: string;
  seller: string;
  source: string;
  blockNumber: number;
  blockTimestamp: number;
}

export interface CollectionStatsRepository {
  floorPrice: number;
  ceilPrice: number;
  totalVolume: number;
  totalNumSales: number;
  avgPrice: number;
  updateAt: number;
}

export interface NftStatsRepository {
  floorPrice: number;
  ceilPrice: number;
  totalVolume: number;
  totalNumSales: number;
  avgPrice: number;
  updateAt: number;
}
