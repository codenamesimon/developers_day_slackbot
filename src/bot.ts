import { logger } from './logger.js';
import { Slack } from './slack.js';
import { Secrets } from './secrets.js'
import { resolve } from 'path';

/**
 * The mind of the bot
 */
export abstract class Bot {

	protected abstract getOauthToken(): string;

	protected abstract getSigningSecret(): string;

	protected abstract processDirectMessage(message: string, userId: string, channelId: string): void;

	protected abstract processCommand(message: string, channelId: string, userId: string, responseUrl: string, threadTs: string): void;

	public async processEventRequest(request: any, response: any): Promise<void> {
		const requestValid: boolean = await this.validateRequest(request);
		if(!requestValid) return response.status(400).end();

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

	public async processCommandRequest(request: any, response: any): Promise<void> {
		const requestValid: boolean = await this.validateRequest(request);
		if(!requestValid) return response.status(400).end();

		// Responding with 200 ASAP for Slack
		response.setHeader('Content-Type', 'application/json');
		response.status(200).end();

		const authedUsersRaw:string = await Secrets.getSecret('command-authed-users');
		const authedUsers = authedUsersRaw.split(',');

		// Check if user is authorized to use commands
		const userId = request.body.user_id;
        if(!authedUsers.includes(userId)) {
			return Slack.SendCommandToResponseUrl({
                response_type: "ephemeral",
                replace_original: false,
                text: "You really though you're in control, huh?",
			}, request.body.response_url, 'kretes');
		}

		// Validate text
		let text: string = request.body.text;
        if(text === undefined || text === '') {
			return Slack.SendCommandToResponseUrl({
                response_type: "ephemeral",
                replace_original: false,
                text: "I don't understand that. (Text is undefined or empty.)",
            }, request.body.response_url, 'kretes');
		}

		// Try to get theread timestamp
		const urlString: string = text.split(' ')[0];
		let url: URL;
		let threadTs: string;
		if(urlString) {
			try{
				url = new URL(urlString);
			}
			catch(TypeError) {
				// todo: change verbose
				logger.info('not a valid url in this message');
			}
		}

		if(url !== undefined) {

			logger.info('detected valid url: ' + url)

			if(url.hostname.endsWith('slack.com')) {
				// Url to slack
				const possibleTs: string = url.pathname.match(/(?<=p)\d{16}/)[0];
				if(possibleTs) {
					threadTs = possibleTs.substr(0,10) + '.' + possibleTs.substr(11);
					logger.info('target ts of the message:' + threadTs);

					const arr = text.split(' ');
					arr.shift();
					text =  arr.join(' ');
				} else {
					logger.info('no ts in url path ' + url.pathname);
				}
			}
		}

		return this.processCommand(text, request.body.channel_id, userId, request.body.response_url, threadTs);
	}

	private async validateRequest(request: any): Promise<boolean> {
		// Disable validation on development
		const env = process.env.NODE_ENV || 'development';
		if(env === 'development') {
			return true;
		}

		const timestampHeader: any = request.get("X-Slack-Request-Timestamp");
		const currentTime = Math.floor(new Date().getTime()/1000);

		if (timestampHeader === undefined || Math.abs(currentTime - timestampHeader) > 300) {
			return false;
		}

		// New Slack verification
		// https://api.slack.com/authentication/verifying-requests-from-slack
		const token = await Secrets.getSecret(this.getSigningSecret());
		if(token === undefined) return false;

		const requestBody = request.rawBody;
		const slackSignature: string = request.get("X-Slack-Signature");
		const baseString: string = `v0:${timestampHeader}:${requestBody}`;
		const hash = 'v0=' + require('crypto').createHmac("sha256",token).update(baseString).digest('hex');

		logger.info('hash check',{computed: hash, expected: slackSignature, status: hash === slackSignature})

		if(hash !== slackSignature) return false;
		return true;
	}

	protected postMessageAsResponse(message: string, responseUrl: string, ephemeral: boolean): Promise<any> {
		return Slack.SendCommandToResponseUrl({
			response_type: ephemeral ? 'ephemeral' : 'in_channel',
			replace_original: false,
			text: message,
		}, responseUrl, this.getOauthToken());
	}

	protected postMessageInThread(message: string, channelId: string, threadTs: string): Promise<any> {
		return Slack.SendSlackJsonApiRequest({
			channel: channelId,
			text: message,
			thread_ts: threadTs
		}, 'chat.postMessage', this.getOauthToken());
	}

	/**
	 * Reply to the user with a message
	 * @param message Message to reply with to the user
	 */
	protected replyWithMessage(message: string, channelId: string) : void {

		Slack.SendSlackJsonApiRequest({
			channel: channelId,
			text: message
		}, "chat.postMessage", this.getOauthToken());
	}
}