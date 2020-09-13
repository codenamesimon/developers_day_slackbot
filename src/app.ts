import express = require('express');
import * as bodyParser from 'body-parser'

import { IncomingMessage, ServerResponse } from 'http';

import { logger } from './logger.js';

import { Kretes } from './kretes.js'
import { Rexor } from './rexor.js'
import { Fire } from './firestore.js';
import { User } from './user';
import { Slack } from './slack.js'

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
		this.express.use(bodyParser.json({
			verify: (request: IncomingMessage, response: ServerResponse, buffer: Buffer, encoding: string) => {
				// Here we add rawBody to request object
				request.rawBody = buffer.toString();
			}
		}));
		this.express.use(bodyParser.urlencoded({
			extended: true,
			verify: (request: IncomingMessage, response: ServerResponse, buffer: Buffer, encoding: string) => {
				request.rawBody = buffer.toString();
			}
		}));

		// In general there are 2 bots served by the same app.
		// So routing is /kretes/events /kretes/command for first
		// And /rexor/events and /rexor/command for the second one
		// As they are technically separate bot apps, they utilize different keys and different secrets

		// routing
		const router = express.Router();

		router.post('/kretes/events', this.processKretesEvent)
		router.post('/kretes/command', this.processKretesCommand)
		router.post('/rexor/events', this.processRexorEvent)
		router.post('/rexor/command', this.processRexorCommand)

		const env = process.env.NODE_ENV || 'development';
		if(env === 'development') router.get('/test', this.localTest)

		this.express.use('/', router)
	}

	private async processKretesEvent(request: any, response: any): Promise<void> {
		return new Kretes().processEventRequest(request, response);
	}

	private async processKretesCommand(request: any, response: any): Promise<void> {
		return new Kretes().processCommandRequest(request, response);
	}

	private async processRexorEvent(request: any, response: any): Promise<void> {
		return new Rexor().processEventRequest(request, response);
	}

	private async processRexorCommand(request: any, response: any): Promise<void> {
		return new Rexor().processCommandRequest(request, response);
	}

	private async localTest(request: any, response: any) {
		response.status(200).end();
	}
}