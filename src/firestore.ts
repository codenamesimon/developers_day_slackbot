import { logger } from './logger.js';
import { User } from './user.js';

/**
 * Insert and request data from Firestore
 */
export class Fire {

    /**
     * Fetches all data from Firestore, a lot of data you don't need.
     * @returns {object} all firestore collection and client data
     */
	public static async getStore(): Promise<any> {

		const snapshot = await Fire.getDatabase().collection('points').get();
		snapshot.forEach((doc: { id: any; data: () => any; }) => {
			logger.info(doc.id + ' => ' + doc.data());
		});

		const data = snapshot;
		return snapshot;
	}

    /**
     * Upserts an object to the points collection
     * @param user user object containing user id, login and points data
     */
	public static async upsertData(user: User): Promise<any> {

		const response: any = {};

		if (user?.slackId) {
			const document = Fire.getDatabase().collection('points').doc(user.slackId);

			logger.info(JSON.parse(JSON.stringify(user)));
			await document.set(JSON.parse(JSON.stringify(user)));
			response.message = 'User object added for: ' + user.slackId;
			response.data = user;

		} else {
			response.message = 'User data rejected for mising identifier';
		}

		return response;
	}

    /**
     * Fetches a user data object with points
     * @param userId user's slack id
     * @returns {any} user data containing slack id, username, language and points data
     */
	public static async getData(userId: string): Promise<any> {

		const response: any = {};

		if (userId) {
			logger.info('User Id: ' + userId);

			const pointsRef = Fire.getDatabase().collection('points').doc(userId);
			const document = await pointsRef.get();

			if (document.exists) {
				response.data = Object.assign(new User('', '', ''), document.data());
				response.message = 'User object received for: ' + response.data.slackId;

			} else {
				response.message = 'No data for the specified user';
			}

		} else {
			response.message = 'User not specified';
		}
		return response;
	}

	public static async deleteData(userId: string): Promise<void> {
		await Fire.getDatabase().collection('points').doc(userId).delete();
	}

	private static getDatabase() {
		const Firestore = require('@google-cloud/firestore');

		return new Firestore({
			projectId: process.env.GOOGLE_CLOUD_PROJECT,
			keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
		});
	}
}