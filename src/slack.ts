import * as https from 'https'
import * as querystring from 'querystring'
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
    public static async SendJsonApiRequest(data: any, endpoint: string, authKeyId: string): Promise<any> {

        const postData = JSON.stringify(data);
        const authKey = await Secrets.getSecret(authKeyId);

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

                    logger.info(`Slack API responded with a code ${response.statusCode}.`, jsonBody);

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

    /**
     * Sends message to slack by response url
     * @param data Data to send in payload
     * @param endpoint Endpoint on which to send the request
     */
    public static async SendCommandToResponseUrl(data: any, responseUrl: string, authKeyId: string): Promise<any> {

        const url = new URL(responseUrl);
        const postData = JSON.stringify(data);
        const authKey = await Secrets.getSecret(authKeyId);

        const requestOptions = {
            host: url.hostname,
            path: url.pathname,
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
                    logger.info(`Slack API responded with a code ${response.statusCode}.`, body);
                    resolve(body);
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

    /**
     * Sends message to slack by response url
     * @param data Data to send in payload
     * @param endpoint Endpoint on which to send the request
     */
    public static async SendUrlEncoded(data: any, endpoint: string, authKeyId: string): Promise<any> {

        const authKey = await Secrets.getSecret(authKeyId);
        data.token = authKey;
        const postData = querystring.stringify(data);

        const requestOptions: https.RequestOptions = {
            host: 'slack.com',
            path: "/api/" + endpoint + "?" + postData,
            method: "GET",
            headers: {
                'Content-Type': "application/x-www-form-urlencoded; charset=utf-8"
            }
        };

        const responseBody = await new Promise<any>((resolve, reject) => {

            const request = https.get(requestOptions, (response) => {
                response.setEncoding('utf8');

                let body = '';
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => {

                    let jsonBody = null;
                    try {
                        jsonBody = JSON.parse(body);
                    }
                    catch (e) {

                        logger.error('Slack JSON API response parsing failed with error: ' + e, response);

                        reject(e);
                        return;
                    }

                    logger.info(`Slack API responded with a code ${response.statusCode}.`, jsonBody);

                    resolve(jsonBody);
                });
            });

            request.on('error', (e) => {
                logger.error("Slack JSON API request failed with error: " + e);
                reject(e);
            });
        });

        return responseBody;
    }
}