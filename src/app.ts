import express = require('express');
import * as bodyParser from 'body-parser'
import {SlackEventController} from './slackEventController.js'

import { IncomingMessage, ServerResponse } from 'http';

import { logger } from './logger.js';
import { Secrets } from './secrets.js'

/**
 * Application root.
 * Handles routing
 */
export class App {

	/**
	 * Express module instance
	 */
	public express: any;

	/**
	 * Initialization
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

	/**
	 * Veryfying that the request is coming from Slack API, otherwise rejecting the request
	 * This is a middleware method
	 * @param request Request object. Contains headers and body
	 * @param response Response object to interact with
	 * @param next Callback to invoke if the processing of the request should continue
	 */
	private async validateRequest(request: any, response: any, next: () => void): Promise<void> {

		logger.info(request.rawBody);

		// Disable validation on development
		const env = process.env.NODE_ENV || 'development';
		if(env === 'development') {
			next();
			return;
		}

		const timestampHeader: any = request.get("X-Slack-Request-Timestamp");
		const currentTime = Math.floor(new Date().getTime()/1000);

		if (Math.abs(currentTime - timestampHeader) > 300) {
			return response.status(400).send('');
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