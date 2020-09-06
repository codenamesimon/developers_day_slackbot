import { logger } from './logger.js';
import { IncomingMessage, ServerResponse } from 'http';
import Bot = require('./bot.js');
import { Secrets } from './secrets.js'

/**
 * Target object for slack communication
 */
export class SlackEventController {

    /**
     *  This method is target for the slack API endpoint
     * @param request Request object
     * @param response Response object
     */
    static processSlackRequest(request: any, response: any): void {

        let responseObject: any;

        // First, check for any requests that require some body conetnt in response to slack's request.
        switch (request.body.type) {
            case "url_verification":
                responseObject = { challange: request.body.challenge }
                break;
            default:
                responseObject = {};
                break;
        }

        // Responding with 200 ASAP for Slack
        response.setHeader('Content-Type', 'application/json');
        response.status(200).send(JSON.stringify(responseObject));

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
                        new Bot.Bot().processDirectMessage(request.body.event.text,
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
    }

	/**
	 * Veryfying that the request is coming from Slack API, otherwise rejecting the request
	 * This is a middleware method
	 * @param request Request object. Contains headers and body
	 * @param response Response object to interact with
	 * @param next Callback to invoke if the processing of the request should continue
	 */
	public static async validateRequest(request: any, response: any, next: () => void): Promise<void> {

		logger.info(request);

		if(request.url !== '/slack')
		{
			next();
			return;
		}

		// Disable validation on development
		const env = process.env.NODE_ENV || 'development';
		if(env === 'development') {
			return next();
		}

		const timestampHeader: any = request.get("X-Slack-Request-Timestamp");
		const currentTime = Math.floor(new Date().getTime()/1000);

		if (timestampHeader === undefined || Math.abs(currentTime - timestampHeader) > 300) {
			return response.status(400).end();
		}

		// New Slack verification
		// https://api.slack.com/authentication/verifying-requests-from-slack
		await Secrets.getSecret("slack-signing-secret").then(token => {

			const requestBody = request.rawBody;
			const slackSignature: string = request.get("X-Slack-Signature");
			const baseString: string = `v0:${timestampHeader}:${requestBody}`;
			const hash = 'v0=' + require('crypto').createHmac("sha256",token).update(baseString).digest('hex');

			logger.info('hash check',{computed: hash, expected: slackSignature, status: hash === slackSignature})

			if(hash !== slackSignature) return response.status(400).send('Invalid signature');
			next();

		}).catch(error => {
			logger.error(error);
			response.status(500).send(`${error}`);
		});
	}
}