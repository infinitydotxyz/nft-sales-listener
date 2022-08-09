import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { RageQuitEvent, StakerEventType } from '@infinityxyz/lib/types/core/StakerEvents';
import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { BigNumber, ethers } from 'ethers';
import { BlockProvider } from '../block-provider';
import { ContractListener, Events } from './contract-listener.abstract';

export class RageQuitListener extends ContractListener<RageQuitEvent, Events<RageQuitEvent>> {
  public readonly eventName = 'RageQuit';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
    this._eventFilter = contract.filters.RageQuit();
  }

  async decodeLog(args: ethers.Event[]): Promise<RageQuitEvent | null> {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return null;
    }
    const event: ethers.Event = args[args.length - 1];
    const eventData = event.args;
    if (eventData?.length !== 3) {
      return null;
    }

    const user = trimLowerCase(String(eventData[0]));
    const amountReceived = BigNumber.from(String(eventData[1])).toString();
    const penaltyAmount = BigNumber.from(String(eventData[2])).toString();
    const block = await this._blockProvider.getBlock(event.blockNumber);
    return {
      discriminator: StakerEventType.RageQuit,
      user,
      amount: amountReceived,
      penaltyAmount,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash,
      stakerContractAddress: this._contract.address,
      chainId: this.chainId,
      timestamp: block.timestamp * 1000
    };
  }
}
