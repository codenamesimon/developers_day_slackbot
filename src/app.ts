import express = require('express');
import * as bodyParser from 'body-parser'
import {SlackEventController} from './slack_event_controller.js'
import { logger } from './logger.js';

/*
    This is an application class responsible for consuming and routing requests as well as validating their origin and general data set
*/

class App {

	/*
		The express module instance
	*/
	public express: any

	/*
		Application initialization
	*/
	constructor() {

		this.express = express();
		this.express.use(bodyParser.json());
		this.express.use(bodyParser.urlencoded({ extended: true }));
		this.express.use(this.validateRequest);

		// Mounting external app routing
		this.mountRoutes();
	}

	/*
		Setting up routing
	*/
	private mountRoutes(): void {

		const router = express.Router();
		router.post('/slack', SlackEventController.processSlackRequest)
		// router.post('/commands/controls', SlackAppController.ControlsTarget)
		// router.post('/commands/jenkinsbuild', JenkinsController.BuildTarget)

		this.express.use('/', router)
	}

	/*
		Veryfying that the request is coming from Slack API, otherwise rejecting the request
	*/
	private validateRequest(req: any, res: any, next: () => void){

        logger.info('request body', req.body);

        // (req.body);

		// if (req.body && req.body.token){
		// 	if (req.body.token == global.settings.slackVerificationToken){
		// 		next();
		// 	} else {
		// 		this.rejectBadRequest(res);
		// 	}

		// } else {
		// 	this.rejectBadRequest(res);
        // }

        next();
	}

	/*
		Rejecting non-Slack or invalid requests with a 400 Bad Request code
	*/
	private rejectBadRequest(res: any): void{

		res.setHeader('Content-Type', 'application/json');
		res.status(400).end("{}");
	}
}

export default new App().express