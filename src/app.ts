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
			solved3: all.filter(p => p.solved3).length,
			solvedAll: all.filter(p => p.solved1 && p.solved2 && p.solved3).length,
			raw: all
		}
		response.setHeader('Content-Type', 'application/json');
		response.status(200).send(JSON.stringify(report));
	}

	private async fullResults(request: any, response: any) {
		const tasksNumber = 5;
		const snapshot = await Fire.getStore();

		const participants: any[] = [];

		const authedUsersRaw: string = await Secrets.getSecret('command-authed-users');
		const authedUsers = authedUsersRaw.split(',');

		snapshot.forEach((doc: { id: any; data: () => any; }) => {

			const user: User = doc.data();

			if (user.points === undefined) return;
			if (authedUsers.includes(doc.id))
			{
				logger.info('skipping ' + doc.id);
				return;
			}

			const score = {
				username: user.username,
				times: user.points.map((task: { timestamp: any; }) => Date.parse(task.timestamp))
			}

			participants.push(score);
		});

		// Filtering for all participants whose timescores filtered by nulls are still five elements + sorting by the last task timestamp
		const finalists = participants.filter(score => score.times.filter((time: any) => time).length === tasksNumber).sort((a, b) => (a.times[tasksNumber - 1] > b.times[tasksNumber - 1]) ? 1 : -1);

		response.setHeader('Content-Type', 'application/json');
		response.status(200).send(JSON.stringify({pn: participants.length, lt: finalists.length, raw: finalists}));
		return;
		// Sorting by best timestamp for each task
		const dailyWinners = [];
		for (let i: number = 0; i < tasksNumber; i++) {
			const dailyWinner = participants.sort((a, b) => a.times[i] - b.times[i])[0];
			dailyWinners.push({ username: dailyWinner.username, time: dailyWinner.times[i] });
		}

		// Extracting min timestamps for each day from daily winners
		const dailyMins: number[] = [];
		for (let i: number = 0; i < tasksNumber; i++) {
			dailyMins.push(dailyWinners[i].time);
		}

		// Querying for master of time, creating time deltas array and it's sum
		finalists.forEach(finalist => {
			finalist.deltas = [];
			for (let i: number = 0; i < tasksNumber; i++) {
				finalist.deltas.push(finalist.times[i] - dailyMins[i]);
			};
			finalist.deltaSum = finalist.deltas.reduce((a: number, b: number) => a + b, 0);
		});

		const report: any = {
			winners: {
				masteOfRules: dailyWinners[tasksNumber - 1],
				masterOfTime: finalists.sort((a, b) => (a.deltaSum > b.deltaSum) ? 1 : -1)[0],
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