import { logger } from './logger.js';
import { Slack } from './slack.js';
import { Secrets } from './secrets.js'

/**
 * Base class for bots
 */
export abstract class Bot {

	/**
	 * Returns an Oauth Token secret identfier
	 */
	protected abstract getOauthTokenId(): string;

	/**
	 * Returns Slack signing secret identifier
	 */
	protected abstract getSigningSecretId(): string;

	/**
	 * Processes a direct message from user
	 * @param message Test of the message
	 * @param userId Identifier o the user
	 * @param channelId Identifier of the channel (DM) on which the message was sent
	 */
	protected abstract processDirectMessage(message: string, userId: string, channelId: string): void;

	/**
	 * Processes a slash command
	 * @param message Text of the command
	 * @param channelId Id of the channel on which the command was used
	 * @param userId Identifier of the user who triggered the command
	 * @param responseUrl response URL provided by slack API
	 * @param threadTs Timestamp of the message to which the command should respond extracted from the URL param
	 */
	protected abstract processCommand(message: string, channelId: string, userId: string, responseUrl: string, threadTs: string): void;

	/**
	 * Handle request from slack
	 * @param request Request object
	 * @param response Response object
	 */
	public async processEventRequest(request: any, response: any): Promise<void> {

		const requestValid: boolean = await this.validateRequest(request);
		if (!requestValid) return response.status(400).end();

		response.setHeader('Content-Type', 'application/json');

		// First, check for any requests that require some body conetnt in response to slack's request.
		switch (request.body.type) {
			case "url_verification":
				response.status(200).send(JSON.stringify({ challange: request.body.challenge }));
				break;
			default:
				response.status(200).end();
				break;
		}

		// After responding to slack process the event
		switch (request.body.type) {
			case "event_callback":
				switch (request.body.event.type) {
					case "message":

						if (request.body.event.bot_id !== undefined) {
							// This is a bot message. Don't respond to that.
							break;
						}

						// So, someone sent us message. We need to read it
						// and respond to the user Via DM
						this.processDirectMessage(request.body.event.text,
							request.body.event.user,
							request.body.event.channel);
						break;
					default: break;
				}
				break;
			default:
				// do nothing
				break;
		}

		return;
	}

	/**
	 * Handles slash command requests from slack.
	 * If the message starts with a url to message, the command parses the url to retrieve timestamp to thread
	 * @param request Request object
	 * @param response Response object
	 */
	public async processCommandRequest(request: any, response: any): Promise<void> {
		const requestValid: boolean = await this.validateRequest(request);
		if (!requestValid) return response.status(400).end();

		// Responding with 200 ASAP for Slack
		response.setHeader('Content-Type', 'application/json');
		response.status(200).end();

		const authedUsersRaw: string = await Secrets.getSecret('command-authed-users');
		const authedUsers = authedUsersRaw.split(',');

		// Check if user is authorized to use commands
		const userId = request.body.user_id;
		if (!authedUsers.includes(userId)) {
			return this.postMessageAsResponse("You really though you're in control, huh?", request.body.response_url, true);
		}

		// Validate text
		let text: string = request.body.text;
		if (text === undefined || text === '') {
			return this.postMessageAsResponse("I don't understand that. (Text is undefined or empty.)", request.body.response_url, true);
		}

		// Try to get theread timestamp
		const urlString: string = text.split(' ')[0];
		let url: URL;
		let threadTs: string;
		if (urlString) {
			try {
				url = new URL(urlString);
			}
			catch (TypeError) {
				logger.info('not a valid url in this message');
			}
		}

		if (url !== undefined) {

			if (url.hostname.endsWith('slack.com')) {
				// Url to slack
				const possibleTs: string = url.pathname.match(/(?<=p)\d{16}/)[0];
				if (possibleTs) {
					threadTs = possibleTs.substr(0, 10) + '.' + possibleTs.substr(11);
					logger.info('target ts of the message:' + threadTs);

					const arr = text.split(' ');
					arr.shift();
					text = arr.join(' ');
				} else {
					logger.info('no ts in url path ' + url.pathname);
				}
			}
		}

		return this.processCommand(text, request.body.channel_id, userId, request.body.response_url, threadTs);
	}

	/**
	 * Valiudates whether the request has came from slack.
	 * @param request Request object
	 */
	private async validateRequest(request: any): Promise<boolean> {
		// Disable validation on development
		const env = process.env.NODE_ENV || 'development';
		if (env === 'development') {
			return true;
		}

		const timestampHeader: any = request.get("X-Slack-Request-Timestamp");
		const currentTime = Math.floor(new Date().getTime() / 1000);

		if (timestampHeader === undefined || Math.abs(currentTime - timestampHeader) > 300) {
			return false;
		}

		// New Slack verification
		// https://api.slack.com/authentication/verifying-requests-from-slack
		const token = await Secrets.getSecret(this.getSigningSecretId());
		if (token === undefined) return false;

		const requestBody = request.rawBody;
		const slackSignature: string = request.get("X-Slack-Signature");
		const baseString: string = `v0:${timestampHeader}:${requestBody}`;
		const hash = 'v0=' + require('crypto').createHmac("sha256", token).update(baseString).digest('hex');

		logger.info('hash check', { computed: hash, expected: slackSignature, status: hash === slackSignature })

		if (hash !== slackSignature) return false;
		return true;
	}

	/**
	 * Sends a message as a response to the response url provided by slack
	 * @param message Text of the message to send.
	 * @param responseUrl response URL provided by slack
	 * @param ephemeral Should the response be an ephermeral message, or sent to channel
	 */
	protected postMessageAsResponse(message: string, responseUrl: string, ephemeral: boolean): Promise<any> {
		return Slack.SendCommandToResponseUrl({
			response_type: ephemeral ? 'ephemeral' : 'in_channel',
			replace_original: false,
			text: message,
		}, responseUrl, this.getOauthTokenId());
	}

	/**
	 * Posts message to a thread
	 * @param message Text of the message to send.
	 * @param channelId Identifier of the channel containing the thread
	 * @param threadTs Timestamp to the root of the thread message
	 */
	protected postMessageInThread(message: string, channelId: string, threadTs: string): Promise<any> {
		return Slack.SendJsonApiRequest({
			channel: channelId,
			text: message,
			thread_ts: threadTs
		}, 'chat.postMessage', this.getOauthTokenId());
	}

	/**
	 * Reply to the user with a message
	 * @param message Message to reply with to the user
	 */
	protected replyWithMessage(message: string, channelId: string): void {

		Slack.SendJsonApiRequest({
			channel: channelId,
			text: message
		}, "chat.postMessage", this.getOauthTokenId());
	}
}