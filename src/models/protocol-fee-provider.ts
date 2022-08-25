/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { InfinityExchangeABI } from '@infinityxyz/lib/abi/infinityExchange';
import { ChainId } from '@infinityxyz/lib/types/core';
import { Firebase } from '../database/Firebase';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { ProtocolFeeUpdatedEvent } from './contract-listeners/protocol-fee-updated.listener';
import { Providers } from './providers';
import { firestoreConstants } from '@infinityxyz/lib/utils';

export type ProtocolFeeProps = Pick<ProtocolFeeUpdatedEvent, 'blockNumber' | 'transactionIndex' | 'protocolFeeBPS'>;

export class ProtocolFee {
  constructor(private _props: ProtocolFeeProps) {}

  get blockNumber(): number {
    return this._props.blockNumber;
  }

  get transactionIndex(): number {
    return this._props.transactionIndex;
  }

  getFees(totalPrice: BigNumberish) {
    const price = BigNumber.from(totalPrice);
    const protocolFeeBPS = parseInt(this._props.protocolFeeBPS, 10);
    const feePercent = protocolFeeBPS / 100;
    const feesPaidWei = price.mul(protocolFeeBPS).div(10000).toBigInt();
    return {
      feesPaidWei,
      feePercent,
      protocolFeeBPS: protocolFeeBPS
    };
  }
}

export class ProtocolFeeProvider {
  private _protocolFees: Map<string, { saved: ProtocolFee[]; backup?: Promise<ProtocolFee> }> = new Map();

  private initialSync: Promise<void>;
  constructor(private firebase: Firebase, private providers: Providers) {
    this.initialSync = this._sync();
  }

  public async getProtocolFee(
    contractAddress: string,
    chainId: ChainId,
    blockNumber: number,
    transactionIndex: number
  ): Promise<ProtocolFee> {
    await this.initialSync;
    const fees = this._protocolFees.get(contractAddress) ?? { saved: [], backup: undefined };
    const savedProtocolFee = fees.saved.find((protocolFee) => {
      return (
        protocolFee.blockNumber < blockNumber ||
        (protocolFee.blockNumber === blockNumber && protocolFee.transactionIndex < transactionIndex)
      );
    });
    if (!savedProtocolFee) {
      try {
        let backupFee = fees.backup;
        if (!backupFee) {
          backupFee = this._getCurrentProtocolFee(contractAddress, chainId);
          this._protocolFees.set(contractAddress, { saved: fees.saved, backup: backupFee });
        }
        const fee = await backupFee;
        return fee;
      } catch (err) {
        console.error(err);
      }
      throw new Error('No protocol fee found');
    }
    return savedProtocolFee;
  }

  private _sync() {
    let isInitial = true;
    return new Promise<void>((resolve, reject) => {
      this.firebase.db.collection(firestoreConstants.PROTOCOL_FEE_EVENTS_COLL).onSnapshot(
        (snapshot) => {
          snapshot.docChanges().forEach((snap) => {
            const event = snap.doc.data() as ProtocolFeeUpdatedEvent | undefined;
            if (event) {
              const events = this._protocolFees.get(event.contractAddress) ?? { saved: [], backup: undefined };
              const sortedEvents = events.saved.sort((a, b) => {
                return a.blockNumber - b.blockNumber;
              });
              events.saved = sortedEvents;
              this._protocolFees.set(event.contractAddress, events);
            }
          });
          if (isInitial) {
            isInitial = false;
            resolve();
          }
        },
        (err) => {
          console.error(err);
          if (isInitial) {
            isInitial = false;
            reject(err);
          }
        }
      );
    });
  }

  protected async _getCurrentProtocolFee(contractAddress: string, chainId: ChainId): Promise<ProtocolFee> {
    const provider = this.providers.getProviderByChainId(chainId);
    const contract = new ethers.Contract(contractAddress, InfinityExchangeABI, provider);
    const feeBPS: number = await contract.protocolFeeBps();
    const blockNumber = await contract.provider.getBlockNumber();
    return new ProtocolFee({
      blockNumber: blockNumber,
      protocolFeeBPS: `${feeBPS}`,
      transactionIndex: 0
    });
  }
}
