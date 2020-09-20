# Slack Bot used for Developers Day Competition

The app is a target for two slack bots used in the competition. Every day a riddle was posted, and messages must have been sent as a DM to one of the bot. The second bot is there just for drama.

## Environment and secrets

GCP App Engine during execution exposes some of the environment variables. You can see all of them [in the GAE docs](https://cloud.google.com/appengine/docs/standard/nodejs/runtime).

This app reads specified env variables:
- NODE_ENV
- PORT
- GOOGLE_CLOUD_PROJECT

Additionally accessing GCP resources in development environment requires those env vaiables:
- GOOGLE_APPLICATION_CREDENTIALS

This project uses [dotenv](https://www.npmjs.com/package/dotenv) as a **development** dependency. You will need to create a `.env` file in the root of the directory with all the used env variables set.
Example `.env` file:
```
GOOGLE_CLOUD_PROJECT=gcp_project_id
NODE_ENV=development
GOOGLE_APPLICATION_CREDENTIALS=/users/username/keys/my_service_account.json
```

Don't set GOOGLE_APPLICATION_CREDENTIALS in `.env` file if you have it set as a global variable. Don't use `.env` for deployment. Use Secret Manager for storing any secrets.
On localhost start with `npm run start:dev` because it injects the **dotenv** to node app.

## Setup GCP on localhost

To access GCP's resources on localhost, you need to have:
1. Service account created.
2. Service account added to the project
3. Generated .json key file for that service account
4. Adding a set of permissions for that service account

For details on this see:
https://cloud.google.com/secret-manager/docs/reference/libraries#setting_up_authentication

## GCP permissions required for service account
- Secret Manager Secret Accessor

## General configuration:
- Tech stack on GCP
- App Engine with Node 12
- Logger: [Winston](https://github.com/winstonjs/winston)
- GCP Stackdriver Logging for Winston: [Link](https://cloud.google.com/nodejs/docs/reference/logging-winston/0.11.x)
- Slack keys and all secrets are kept on GCP [Secret Manager](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)
- Data on [Firestore](https://cloud.google.com/firestore)

## Slack bot necessary permissions:

- chat:write
- commands
- im:history
- im:read
- im:write
- users.profile:read
- users:read.email
