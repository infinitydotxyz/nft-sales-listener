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

export interface NftSale {
  chainId: string;
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  collectionAddress: string;
  tokenId: string;
  price: BigInt | number;
  paymentToken: string;
  buyer: string;
  seller: string;
  quantity: number;
  source: SALE_SOURCE;
  tokenType: TOKEN_TYPE;
}

export interface Stats {
  chainId: string;
  floorPrice: number;
  ceilPrice: number;
  totalVolume: number;
  totalNumSales: number;
  avgPrice: number;
  updateAt: number;
}
