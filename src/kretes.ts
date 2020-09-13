import { Bot } from './bot.js';
import { logger } from './logger.js';
import * as fs from 'fs';

export class Kretes extends Bot {

    private static lines: string[] = fs.readFileSync('lines.txt','utf8').split('\n');

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
	public processDirectMessage(text: string, userId: string, channelId: string): void {

        logger.info(`message to kretes from user ${userId} on channel ${channelId} : ${text}`);

        const max = Kretes.lines.length;
        const rand = Math.floor(Math.random() * max);
        const line = Kretes.lines[rand];

        this.replyWithMessage(Buffer.from(line).toString('base64'), channelId);
    }
}
