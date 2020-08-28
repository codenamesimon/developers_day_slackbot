import express = require('express');
import * as bodyParser from 'body-parser'
import {SlackEventController} from './slack_event_controller.js'
import { logger } from './logger.js';
import { IncomingMessage, ServerResponse } from 'http';

/*
    This is an application class responsible for consuming and routing requests as well as validating their origin and general data set
*/

class App {

	/*
		The express module instance
	*/
	public express: any;


	/*
		Application initialization
	*/
	constructor() {

		this.express = express();
		this.express.use(bodyParser.json( {
			verify: (request: IncomingMessage, response: ServerResponse, buffer: Buffer, encoding: string) => {
				// Here we add rawBody to request object
				request.rawBody = buffer.toString();
			}
		}));
		this.express.use(bodyParser.urlencoded({ extended: true }));
		this.express.use(this.validateRequest);

		// routing
		const router = express.Router();
		router.post('/slack', SlackEventController.processSlackRequest)

		this.express.use('/', router)
	}

	private static async getSecret (secretName:string): Promise<string> {

		const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
		const client = new SecretManagerServiceClient();

		const [version] = await client.accessSecretVersion({
			name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/${secretName}/versions/latest`
		});

		const payload = version.payload.data.toString('utf8');
		return payload;
	}

	/*
		Veryfying that the request is coming from Slack API, otherwise rejecting the request
	*/
	private async validateRequest(req: any, res: any, next: () => void): Promise<void> {

		logger.info(req.rawBody);

		// Disable validation on development
		const env = process.env.NODE_ENV || 'development';
		if(env === 'development')
		{
			next();
			return;
		}

		const timestampHeader: any = req.get("X-Slack-Request-Timestamp");
		const currentTime = Math.floor(new Date().getTime()/1000);

		if (Math.abs(currentTime - timestampHeader) > 300) {
			return res.status(400).send('');
		}

		// New Slack verification
		// https://api.slack.com/authentication/verifying-requests-from-slack
		await App.getSecret("slack-signing-secret").then(token => {

			const requestBody = req.rawBody;
			const slackSignature: string = req.get("X-Slack-Signature");
			const baseString: string = `v0:${timestampHeader}:${requestBody}`;
			const hash = 'v0=' + require('crypto').createHmac("sha256",token).update(baseString).digest('hex');

			logger.info('hash check',{computed: hash, expected: slackSignature, status: hash === slackSignature})

			if(hash !== slackSignature) return res.status(400).send('Invalid signature');
			next();

		}).catch(error => {
			logger.error(error);
			res.status(500).send(`${error}`);
		});
	}
}

export default new App().express