import { logger } from './logger.js';
import { Secrets } from './secrets.js'

export class Posts {

    /**
     * This method is target for the slack API endpoint
     * @param request Request object
     * @param response Response object
     */
    static processCommand(request: any, response: any): void {

        logger.info(request.url);
        response.status(200).end();
    }

    /**
     * Veryfying that the request is coming from authorized source
     * @param request Request object
     * @param response Response object
     */
    public static async validateRequest(request: any, response: any, next: () => void): Promise<void> {

        // Read auth header
        const authHeader: any = request.get("Authorization");
        if(authHeader === undefined) return response.status(401).end();

        const token = authHeader.replace('Bearer ','');
        const secretToken = await Secrets.getSecret('command-token');

        // Check header agains the secret
        if(token !== secretToken) return response.status(401).end();
        return next();
    }
}