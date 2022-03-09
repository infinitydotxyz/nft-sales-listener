import { container, delay } from 'tsyringe';
import Firebase from 'database/Firebase';
import Moralis from 'services/Moralis';
import Logger from 'utils/Logger';
import Providers from 'models/Providers';
import OpenSea from 'services/OpenSea';

export const logger: Logger = container.resolve(Logger);
export const providers: Providers = container.resolve(delay(() => Providers));

export const firebase: Firebase = container.resolve(Firebase);
export const moralis: Moralis = container.resolve(Moralis);
export const opensea: OpenSea = container.resolve(OpenSea);
