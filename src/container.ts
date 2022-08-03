import { container, delay } from 'tsyringe';
import Firebase from 'database/Firebase';
import Logger from 'utils/Logger';
import Providers from './models/Providers';

export const logger: Logger = container.resolve(Logger);
export const providers: Providers = container.resolve(delay(() => Providers));
export const firebase: Firebase = container.resolve(Firebase);
