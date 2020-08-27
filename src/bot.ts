import { logger } from './logger.js';

/*
    This class is the mind of the bot
*/
export class Bot {

    private static instanceId: number = 0;

	public constructor() {
        Bot.instanceId ++;
        logger.info("bot instance" + Bot.instanceId);
	}

	/*
		Setting up routing
	*/
	public processDirectMessage(text: string, userId: string, channelId: string): void {

        logger.info(`user ${userId} on channel ${channelId} with message ${text}`);
    }
}