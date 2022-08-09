import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { BigNumber, ethers } from 'ethers';
import { StakerEventType, TokensUnStakedEvent } from '../../types';
import { BlockProvider } from '../block-provider';
import { ContractListener, Events } from './contract-listener.abstract';



export class TokensUnStakedListener extends ContractListener<TokensUnStakedEvent, Events<TokensUnStakedEvent>> {
  public readonly eventName = 'UnStaked';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, chainId: ChainId) {
    super(contract, blockProvider, chainId);
    this._eventFilter = contract.filters.UnStaked();
  }

  decodeLog(args: ethers.Event[]): TokensUnStakedEvent | null {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return null;
    }
    const event: ethers.Event = args[args.length - 1];
    const eventData = event.args;
    if (eventData?.length !== 2) {
      return null;
    }

    const user = trimLowerCase(String(eventData[0]));
    const amount = BigNumber.from(String(eventData[1])).toString();
    return {
      discriminator: StakerEventType.UnStaked,
      user,
      amount,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash
    };
  }
}
