import { ChainId } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { BigNumber, ethers } from 'ethers';
import { BlockProvider } from 'models/block-provider';
import { ContractListener, Events } from './contract-listener.abstract';

export type ProtocolFeeUpdatedEvent = {
  blockNumber: number;
  txHash: string;
  transactionIndex: number;
  protocolFeeBPS: string;
  timestamp: number;
  contractAddress: string;
  chainId: ChainId;
};

export class ProtocolFeeUpdatedListener extends ContractListener<
  ProtocolFeeUpdatedEvent,
  Events<ProtocolFeeUpdatedEvent>
> {
  public readonly eventName = 'ProtocolFeeUpdated';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
    this._eventFilter = contract.filters.ProtocolFeeUpdated();
  }

  async decodeLog(args: ethers.Event[]): Promise<ProtocolFeeUpdatedEvent | null> {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return null;
    }
    const event = args[args.length - 1];
    const eventData = event.args;
    if (eventData?.length !== 1) {
      return null;
    }

    const block = await this._blockProvider.getBlock(event.blockNumber);
    const protocolFeeBPS = BigNumber.from(eventData[0]).toString();

    return {
      contractAddress: trimLowerCase(this._contract.address),
      blockNumber: event.blockNumber,
      txHash: event.transactionHash,
      transactionIndex: event.transactionIndex,
      protocolFeeBPS,
      timestamp: block.timestamp * 1000,
      chainId: this.chainId
    };
  }
}
