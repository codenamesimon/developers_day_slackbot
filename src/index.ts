// This line runs the constructor of 'App' which wants settings
import { App }  from './app'
import { logger } from './logger.js';

const port = process.env.PORT || 8080; // default port to listen

// start the Express server
const app = new App().express;
app.listen( port, () => {

    process.on('unhandledRejection', (reason, p) => {
        logger.error('Unhandled Rejection at: Promise:' + p + ' reason: ' +  reason);
    });

    // tslint:disable-next-line:no-console
    logger.info(`Bot Server is listening on port: ${port}`);

    return;
} );
