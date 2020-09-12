import { Bot } from './bot.js';
import { logger } from './logger.js';

export class Rexor extends Bot {

    protected getOauthToken(): string {
        return 'slack-bot-oaut-token';
    }

    protected getSigningSecret(): string {
        return 'slack-signing-secret';
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

		const parsableMessage = Rexor.removeDiacritics(text.toLowerCase());

		if (parsableMessage.includes('pomoc') || parsableMessage.includes('pomoze')) {
			this.replyWithMessage('Wysyłaj mi tajne kody, które HaCKerMaN ukrył w różnych miejscach! Takie jak np. ten: `Q29yZSBqZXN0IHNwb2tvISEh` :smile:', channelId);
		}
		else if (parsableMessage.includes('Q29yZSBqZXN0IHNwb2tvISEh'.toLowerCase())) {
			this.replyWithMessage('Brawo! Znalazłeś jeden z kodów. To nam pomoże z Hackermanem! Znalazłeś już 1 kod, brakuje nam jeszcze 7! Szukaj dalej!', channelId);
		}
		else {
			this.replyWithMessage('Niestety to nam nie pomoże. Szukaj kodów w różnych miejsach. Możesz zawsze zapytać się mnie o \'pomoc\'.', channelId);
		}
    }

    /**
     * Replace polish diacritics with input string
     * @param input Input string
     */
	private static removeDiacritics(input: string): string {
		return input.replace('ą', 'a')
			.replace('ć', 'c')
			.replace('ę', 'e')
			.replace('ł', 'l')
			.replace('ó', 'o')
			.replace('ś', 's')
			.replace('ż', 'z')
			.replace('ź', 'z');
	}
}