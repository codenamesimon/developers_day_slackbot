import express = require('express');
import * as bodyParser from 'body-parser'

import { IncomingMessage, ServerResponse } from 'http';

import { logger } from './logger.js';

import { Kretes } from './kretes.js'
import { Rexor } from './rexor.js'
import { Fire } from './firestore.js';
import { User } from './user';
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
		if (env === 'development') router.get('/test', this.localTest)

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
		const snapshot = await Fire.getStore();

		const all: any[] = [];

		const authedUsersRaw: string = await Secrets.getSecret('command-authed-users');
		const authedUsers = authedUsersRaw.split(',');

		snapshot.forEach((doc: { id: any; data: () => any; }) => {

			const user: User = doc.data();

			if (user.points === undefined) return;
			if (authedUsers.includes(doc.id)) return

			all.push({
				email: user.username,
				lang: user.language,
				points: user.points.filter(p => p.timestamp).length,
				solved1: user.points.filter(p => p.task === "task1" && p.timestamp).length > 0,
				solved2: user.points.filter(p => p.task === "task2" && p.timestamp).length > 0,
				solved3: user.points.filter(p => p.task === "task3" && p.timestamp).length > 0
			})
		});

		const report: any = {
			allAttempted: all.length,
			solved1: all.filter(p => p.solved1).length,
			solved2: all.filter(p => p.solved2).length,
			solved3: all.filter(p => p.solved2).length,
			solvedAll: all.filter(p => p.solved1 && p.solved2 && p.solved3).length,
			raw: all
		}
		response.setHeader('Content-Type', 'application/json');
		response.status(200).send(JSON.stringify(report));
	}
}