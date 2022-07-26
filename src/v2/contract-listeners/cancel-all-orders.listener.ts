import { trimLowerCase } from '@infinityxyz/lib/utils';
import { ethers } from 'ethers';
import { BlockProvider } from 'v2/models/block-provider';
import { ContractListener } from './contract-listener.abstract';

export type CancelAllOrdersEvent = {
    user: string,
    minOrderNonce: number;
    blockNumber: number;
    txHash: string;
};

export class CancelAllOrders extends ContractListener<CancelAllOrdersEvent> {
  constructor(contract: ethers.Contract, eventFilter: ethers.EventFilter, blockProvider: BlockProvider) {
    super(contract, eventFilter, blockProvider);
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
