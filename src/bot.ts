import { logger } from './logger.js';
import { Slack } from './slack.js';

/**
 * The mind of the bot
 */
export class Bot {

	private user: string;
	private channel: string;

	/**
	 * Process a message from a user.
	 * @param text Text that was sent to the bot
	 * @param userId Id of the user
	 * @param channelId Id of the conversation
	 */
	public processDirectMessage(text: string, userId: string, channelId: string): void {

		logger.info(`user ${userId} on channel ${channelId} with message ${text}`);

		this.user = userId;
		this.channel = channelId;

		const parsableMessage = Bot.removeDiacritics(text.toLowerCase());

		if (parsableMessage.includes('pomoc') || parsableMessage.includes('pomoze')) {
			this.replyWithMessage('Wysyłaj mi tajne kody, które HaCKerMaN ukrył w różnych miejscach! Takie jak np. ten: `Q29yZSBqZXN0IHNwb2tvISEh` :smile:');
		}
		else if (parsableMessage.includes('Q29yZSBqZXN0IHNwb2tvISEh'.toLowerCase())) {
			this.replyWithMessage('Brawo! Znalazłeś jeden z kodów. To nam pomoże z Hackermanem! Znalazłeś już 1 kod, brakuje nam jeszcze 7! Szukaj dalej!');
		}
		else {
			this.replyWithMessage('Niestety to nam nie pomoże. Szukaj kodów w różnych miejsach. Możesz zawsze zapytać się mnie o \'pomoc\'.');
		}
	}

	/**
	 * Reply to the user with a message
	 * @param message Message to reply with to the user
	 */
	private replyWithMessage(message: string) : void {

		Slack.SendSlackJsonApiRequest({
			channel: this.channel,
			text: message
		}, "chat.postMessage");
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