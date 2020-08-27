const port = process.env.PORT || 8080; // default port to listen

// This line runs the constructor of 'App' which wants settings
import app from './app'
import { logger } from './logger.js';

// start the Express server
app.listen( port, () => {

    process.on('unhandledRejection', (reason, p) => {
        logger.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
    });

    // tslint:disable-next-line:no-console
    logger.info(`Bot Server is listening on port: ${port}`);
    return;
} );
