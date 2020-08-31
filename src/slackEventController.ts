import { logger } from './logger.js';
import Bot = require('./bot.js');

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

        // So main events are 'url_verification' for the verification of our APP (see: https://api.slack.com/apps/A8TCE80RW/event-subscriptions?)
        // And the other one is 'event_callback' which is a subscription to the Event API on Slack
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
}