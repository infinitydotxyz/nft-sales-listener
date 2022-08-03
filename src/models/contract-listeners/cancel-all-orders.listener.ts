import { ChainId } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { ethers } from 'ethers';
import { BlockProvider } from '../block-provider';
import { ContractListener, Events } from './contract-listener.abstract';

export type CancelAllOrdersEvent = {
  user: string;
  minOrderNonce: number;
  blockNumber: number;
  txHash: string;
};

export class CancelAllOrdersListener extends ContractListener<CancelAllOrdersEvent, Events<CancelAllOrdersEvent>> {
  public readonly eventName = 'CancelAllOrders';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
    this._eventFilter = contract.filters.CancelAllOrders();
  }

  decodeLog(args: ethers.Event[]): CancelAllOrdersEvent | null {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return null;
    }
    const event: ethers.Event = args[args.length - 1];
    const eventData = event.args;
    if (eventData?.length !== 2) {
      return null;
    }

    // see commented reference below for payload structure
    const user = trimLowerCase(String(eventData[0]));
    const minOrderNonce = parseInt(String(eventData[1]));

    return {
      user,
      minOrderNonce,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash
    };
  }
}
