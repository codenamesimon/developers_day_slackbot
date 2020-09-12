import { Bot } from './bot.js';
import { logger } from './logger.js';

export class Kretes extends Bot {

    protected getSigningSecret(): string {
        return 'kretes-signing-secret';
    }

    protected getOauthToken(): string {
        return 'kretes-oauth-token';
    }

    protected processCommand(message: string, channelId: string, userId: string, responseUrl: string, threadTs: string): void {
        if(threadTs) {
            this.postMessageInThread(message, channelId, threadTs);
        }
        else {
            this.postMessageAsResponse(message, responseUrl, false);
        }
    }

	/**
	 * Process a message from a user.
	 * @param text Text that was sent to the bot
	 * @param userId Id of the user
	 * @param channelId Id of the conversation
	 */
	protected processDirectMessage(text: string, userId: string, channelId: string): void {

		logger.info(`user ${userId} on channel ${channelId} with message ${text}`);

        this.replyWithMessage('eror', channelId);
    }
}
