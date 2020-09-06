import express = require('express');
import * as bodyParser from 'body-parser'

import { IncomingMessage, ServerResponse } from 'http';

import { logger } from './logger.js';

import { SlackEventController } from './slackEventController.js'
import { Posts } from './posts.js'

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
		this.express.use(this.validateRequests);

		// routing
		const router = express.Router();
		router.post('/slack', SlackEventController.processSlackRequest)
		router.post('/command', Posts.processCommand)

		this.express.use('/', router)
	}

	/**
	 * Veryfying if the requests are legit
	 * @param request Request object. Contains headers and body
	 * @param response Response object to interact with
	 * @param next Callback to invoke if the processing of the request should continue
	 */
	private async validateRequests(request: any, response: any, next: () => void): Promise<void> {

		// Disable validation on development
		const env = process.env.NODE_ENV || 'development';
		if(env === 'development') {
			return next();
		}

		if(request.url === '/slack')
		{
			return SlackEventController.validateRequest(request, response, next);
		}
		else if(request.url === '/command')
		{
			return Posts.validateRequest(request,response,next);
		}
		return response.status(400).end();
	}
}