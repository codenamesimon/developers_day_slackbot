import * as https from 'https'
import { Secrets } from './secrets.js'
import { logger } from './logger.js';

/**
 * Class for sending requests to slack
 */
export class Slack {

    /**
     * Sends application/json request to slack
     * @param data Data to send in payload
     * @param endpoint Endpoint on which to send the request
     */
    public static async SendSlackJsonApiRequest(data: any, endpoint: string): Promise<any> {

        const postData = JSON.stringify(data);

        const authKey = await Secrets.getSecret('slack-bot-oaut-token');

        const requestOptions = {
            host: "slack.com",
            path: "/api/" + endpoint,
            method: "POST",
            headers: {
                'Content-Type': "application/json; charset=utf-8",
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': "Bearer " + authKey
            }
        };

        return new Promise<any>((resolve, reject) => {

            const postRequest = https.request(requestOptions, (response) => {
                response.setEncoding('utf8');

                let body = '';
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => {

                    let jsonBody = '';
                    try {
                        jsonBody = JSON.parse(body);
                    }
                    catch (e) {

                        logger.error('Slack JSON API response parsing failed with error: ' + e, response);

                        reject(e);
                        return;
                    }

                    logger.verbose(`Slack API responded with a code ${response.statusCode}.`, jsonBody);

                    resolve(jsonBody);
                });
            });

            postRequest.on('error', (e) => {
                logger.error("Slack JSON API request failed with error: " + e);
                reject(e);
            });

            postRequest.write(postData);
            postRequest.end();
        });
    }
}