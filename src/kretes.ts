import { Bot } from './bot.js';
import { logger } from './logger.js';
import * as fs from 'fs';

/**
 * One of the bots.
 * It responds with a random message after a slack user attempts to message him
 */
export class Kretes extends Bot {

    /**
     * Source of the random responses
     */
    private static lines: string[] = fs.readFileSync('lines.txt','utf8').split('\n');

    /** @inheritdoc */
    protected getSigningSecretId(): string {
        return 'kretes-signing-secret';
    }

    /** @inheritdoc */
    protected getOauthTokenId(): string {
        return 'kretes-oauth-token';
    }

    /** @inheritdoc */
    protected processCommand(message: string, channelId: string, userId: string, responseUrl: string, threadTs: string): void {
        if(threadTs) {
            this.postMessageInThread(message, channelId, threadTs);
        }
        else {
            this.postMessageAsResponse(message, responseUrl, false);
        }
    }

    /** @inheritdoc */
	protected processDirectMessage(text: string, userId: string, channelId: string): void {

        logger.info(`message to kretes from user ${userId} on channel ${channelId} : ${text}`);

        this.replyWithMessage("Did you mean @Rexor?", channelId);
    }
}
