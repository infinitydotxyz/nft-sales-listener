import { ChainId } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { ethers } from 'ethers';
import { BlockProvider } from '../block-provider';
import { ContractListener, Events } from './contract-listener.abstract';

export type CancelMultipleOrdersEvent = {
  user: string;
  nonces: number[];
  blockNumber: number;
  txHash: string;
};

export class CancelMultipleOrdersListener extends ContractListener<
  CancelMultipleOrdersEvent,
  Events<CancelMultipleOrdersEvent>
> {
  public readonly eventName = 'CancelMultipleOrders';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
    this._eventFilter = contract.filters.CancelMultipleOrders();
  }

  decodeLog(args: ethers.Event[]): CancelMultipleOrdersEvent | null {
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
    const nonces = eventData[1];
    const parsedNonces = (nonces as string[]).map((nonce: string) => parseInt(nonce));

    return {
      user,
      nonces: parsedNonces,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash
    };
  }
}
