import { RageQuitEvent, TokensStakedEvent, TokensUnStakedEvent } from '@infinityxyz/lib/types/core';
import { CancelAllOrdersEvent } from '../contract-listeners/cancel-all-orders.listener';
import { CancelMultipleOrdersEvent } from '../contract-listeners/cancel-multiple-orders.listener';
import { MatchOrderBundleEvent } from '../contract-listeners/match-order.listener';
import { ProtocolFeeUpdatedEvent } from '../contract-listeners/protocol-fee-updated.listener';
import { TakeOrderBundleEvent } from '../contract-listeners/take-order.listener';

export interface CancelAllOrdersHandler {
  cancelAllOrders(event: CancelAllOrdersEvent): Promise<void>;
}

export interface CancelMultipleOrdersHandler {
  cancelMultipleOrders(event: CancelMultipleOrdersEvent): Promise<void>;
}

export interface MatchOrdersHandler {
  matchOrderEvent(event: MatchOrderBundleEvent): Promise<void>;
}

export interface TakeOrdersHandler {
  takeOrderEvent(event: TakeOrderBundleEvent): Promise<void>;
}

export interface ProtocolFeeHandler {
  protocolFeeUpdatedEvent(event: ProtocolFeeUpdatedEvent): Promise<void>;
}

export interface TokensStakedHandler {
  tokensStakedEvent(event: TokensStakedEvent): Promise<void>;
}

export interface TokensUnStakedHandler {
  tokensUnStakedEvent(event: TokensUnStakedEvent): Promise<void>;
}

export interface TokensRageQuitHandler {
  tokensRageQuitEvent(event: RageQuitEvent): Promise<void>;
}

export interface EventHandler
  extends CancelAllOrdersHandler,
    CancelMultipleOrdersHandler,
    MatchOrdersHandler,
    TakeOrdersHandler,
    ProtocolFeeHandler,
    TokensStakedHandler,
    TokensUnStakedHandler,
    TokensRageQuitHandler {}

export enum OrderType {
  Listing = 'listing',
  Offer = 'offer'
}
