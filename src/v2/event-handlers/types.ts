import { PreParsedNftSale } from "types";
import { CancelAllOrdersEvent } from "v2/contract-listeners/cancel-all-orders.listener";
import { CancelMultipleOrdersEvent } from "v2/contract-listeners/cancel-multiple-orders.listener";
import { MatchEvent } from "v2/contract-listeners/match.listener";
import { TakeEvent } from "v2/contract-listeners/take.listener";

export interface CancelAllOrdersHandler {
    cancelAllOrders(event: CancelAllOrdersEvent): Promise<void>;
}

export interface CancelMultipleOrdersHandler {
    cancelMultipleOrders(event: CancelMultipleOrdersEvent): Promise<void>;
}

export interface MatchOrdersHandler {
    matchEvent(event: MatchEvent): Promise<void>;
}

export interface TakeOrdersHandler {
    takeEvent(event: TakeEvent): Promise<void>;
}

export interface SaleHandler { 
    nftSalesEvent(sales: PreParsedNftSale[]): Promise<void>;
}

export interface EventHandler extends CancelAllOrdersHandler, CancelMultipleOrdersHandler, MatchOrdersHandler, TakeOrdersHandler, SaleHandler {};

export enum OrderType {
    Listing = 'listing',
    Offer = 'offer'
  }
  