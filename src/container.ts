import { container, delay } from 'tsyringe';
import Firebase from '../src/database/Firebase';
import Moralis from '../src/services/Moralis';
import Logger from '../src/utils/Logger';
import Providers from '../src/models/Providers';

export const logger: Logger = container.resolve(Logger);
export const providers: Providers = container.resolve(Providers);

export const firebase: Firebase = container.resolve(Firebase);
export const moralis: Moralis = container.resolve(Moralis);