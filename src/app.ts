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

		router.get('/playingwithfire', this.performFirestoreDataRequest)

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

	private async performFirestoreDataRequest(request: any, response: any) {
		// 0. Creating a new User object
		const user = new User('U9S4SC9FX', 'aleksandra.szmurlo@gmail.com', 'en');

		// Completing a specific task on a user object (this does not update the database object!)
		// const completed = user.completeTask('task3');
		// logger.info(user.isTaskCompleted('task3'));

		// 1. Requests full Data snapshot from Firestore
		// await Fire.getStore().then(snapshot => {

		// 	response.status(200).send(snapshot);

		// }).catch(error => {
		// 	logger.error(error);
		// 	response.status(500).send(`${error}`);
		// });

		// 2. Inserts or updates a user object to Firestore
		// await Fire.upsertData(user).then(result => {

		// 	response.status(200).send(result);

		// }).catch(error => {
		// 	logger.error(error);
		// 	response.status(500).send(`${error}`);
		// });

		// 3. Requests specific user data from Firestore

		// const data = await Fire.getData('kekekeke');
		// if (data === undefined)
		// 	response.status(500).send();
		// else
		// 	response.status(200).send(data);

		// await Fire.getData(user.slackId).then(data => {
		// 	response.status(200).send(data);

		// }).catch(error => {
		// 	logger.error(error);
		// 	response.status(500).send(`${error}`);
		// });


		// U939VF6LR on channel D01A014GC2V with message a teraz"

		// const userData = await Slack.SendUrlEncoded({user: 'U939VF6LR'}, 'users.info', 'slack-bot-oaut-token');
		// logger.info(userData.user.profile.email);

		await new Kretes().processDirectMessage('2914917', 'U939VF6LR', 'D01A014GC2V');

		response.status(200).end();
	}
}