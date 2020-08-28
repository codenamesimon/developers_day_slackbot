import { logger } from './logger.js';

/*
    This class is the mind of the bot
*/
export class Bot {

	/*
		Setting up routing
	*/
	public processDirectMessage(text: string, userId: string, channelId: string): void {

        logger.info(`user ${userId} on channel ${channelId} with message ${text}`);
    }
}