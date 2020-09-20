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
		if (env === 'development') router.get('/test', this.localTest);
		if (env === 'development') router.get('/results', this.fullResults);

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

		response.setHeader('Content-Type', 'application/json');
		response.status(200).send(JSON.stringify({}));
	}

	private async fullResults(request: any, response: any) {
		const tasksNumber = 5;
		const winnersNumber = 6;
		const publishTimestamps: any = [1600081380175, 1600160028180, 1600244384190, 1600330654192, 1600419874000];
		const snapshot = await Fire.getAllData();

		const participants: any[] = [];

		const authedUsersRaw: string = await Secrets.getSecret('command-authed-users');
		const authedUsers = authedUsersRaw.split(',');

		snapshot.data.forEach((doc: any) => {

			const user: User = doc;

			if (user.points === undefined) return;
			if (authedUsers.includes(user.slackId))
			{
				logger.info('skipping ' + user.slackId);
				return;
			}

			const score = {
				username: user.username,
				times: user.points.map((task: { timestamp: any; }) => Date.parse(task.timestamp))
			}

			participants.push(score);
		});

		// Filtering for all participants whose timescores filtered by nulls are still five elements
		const finalists = participants.filter(score => score.times.filter((time: any) => time).length === tasksNumber);

		// Sorting by best timestamp for each task and picking 6 finalists for each task
		const dailyWinners = [];
		for (let i: number = 0; i < tasksNumber; i++) {
			const taskWinners = [...finalists];
			taskWinners.sort((a, b) => (a.times[i] > b.times[i]) ? 1 : -1);
			dailyWinners.push(taskWinners.splice(0, Math.min(taskWinners.length, winnersNumber)));
		}

		// Querying for master of time, creating time deltas array and it's sum
		finalists.forEach(finalist => {
			finalist.deltas = [];
			for (let i: number = 0; i < tasksNumber; i++) {
				finalist.deltas.push(finalist.times[i] - publishTimestamps[i]);
			};
			finalist.deltaSum = finalist.deltas.reduce((a: number, b: number) => a + b, 0);
		});

		// Sorting by time deltas and picking up 6 finalists with the best sum time
		const sprinters = [...finalists].sort((a, b) => (a.deltaSum > b.deltaSum) ? 1 : -1).splice(0, Math.min(finalists.length, winnersNumber));

		const report: any = {
			winners: {
				masterOfRules: dailyWinners[tasksNumber - 1],
				masterOfTime: sprinters,
				dailyWinners
			},
			numbers: {
				participantsNumber: participants.length,
				finalistsNumber: finalists.length
			},
			raw: {
				participants,
				finalists,
			}
		}
		response.setHeader('Content-Type', 'application/json');
		response.status(200).send(JSON.stringify(report));
	}
}