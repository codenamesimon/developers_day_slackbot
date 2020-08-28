/*
    Slack verification requires access to raw body.
    In express the 'body' is an object.
    So here we're extending the IncomingMessage interface by adding the rawBody field
*/
declare module 'http' {
    interface IncomingMessage {
        rawBody: string;
    }
}