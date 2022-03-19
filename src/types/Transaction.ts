import { NftSale } from "@infinityxyz/lib/types/core/NftSale";

/**
 * represents an ethereum transaction containing sales of one or more nfts
 */
export type Transaction = { sales: NftSale[]; totalPrice: number };
