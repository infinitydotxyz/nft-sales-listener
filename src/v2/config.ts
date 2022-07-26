import { ChainId } from "@infinityxyz/lib/types/core"
import { getExchangeAddress } from "@infinityxyz/lib/utils"
import { WYVERN_EXCHANGE_ADDRESS } from "@infinityxyz/lib/utils/constants"
import { SEAPORT_ADDRESS } from "constants/wyvern-constants"
import { InfinityExchangeContract } from "./contracts/infinity-exchange.contract"
import { OpenSeaContract } from "./contracts/opensea.contract"
import { SeaportContract } from "./contracts/seaport.contract"
import { ContractDescription } from "./contracts/types"

export const infinityExchangeMainnetDesc: ContractDescription = {
    address: getExchangeAddress(ChainId.Mainnet),
    chainId: ChainId.Mainnet,
    type: InfinityExchangeContract
}

export const wyvernExchangeMainnetDesc: ContractDescription = {
    address: WYVERN_EXCHANGE_ADDRESS,
    chainId: ChainId.Mainnet,
    type: OpenSeaContract
}

export const seaportExchangeMainnetDesc: ContractDescription = {
    address: SEAPORT_ADDRESS,
    chainId: ChainId.Mainnet,
    type: SeaportContract
}