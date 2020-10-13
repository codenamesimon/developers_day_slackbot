import { Firestore } from '@google-cloud/firestore';
import { logger } from './logger.js';
import { User } from './user.js';

/**
 * Insert and request data from Firestore
 */
export class Fire {

	/**
	 * Object used for communication with Firestore
	 */
	private static database: Firestore;

	/**
	 * Identifier of the collection used for storing data for given edition
	 */
	private static collectionId: string = "edition-2";

	/**
	 * Initializes the Firstore facade
	 */
	static initialize() {
		Fire.database = new Firestore({
			projectId: process.env.GOOGLE_CLOUD_PROJECT,
			keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
		});
	}

    /**
     * Fetches all data from Firestore, a lot of data you don't need.
     * @returns {object} all firestore collection and client data
     */
	public static async getStore(): Promise<any> {

		return await Fire.database.collection(Fire.collectionId).get();
	}

    /**
     * Upserts an object to the points collection
     * @param user user object containing user id, login and points data
     */
	public static async upsertData(user: User): Promise<any> {

		const response: any = {};

		if (user?.slackId) {
			const document = Fire.database.collection(Fire.collectionId).doc(user.slackId);

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
	public static async getUser(userId: string): Promise<User> {

		if(!userId) {
			logger.error('User not specified in getUser');
			return null;
		}

		const documentRef = Fire.database.collection(Fire.collectionId).doc(userId);
		const document = await documentRef.get();

		if (document.exists) {
			return Object.assign(new User('', '', ''), document.data());
		} else {
			logger.warn('No data for the specified user')
			return null;
		}
	}

    /**
     * Fetches all user data object with points
     * @returns {any} all user data containing slack id, username, language and points data
     */
	public static async getAllData(): Promise<any> {

		const response: any = {};

			const pointsRef = Fire.database.collection(Fire.collectionId);
			const snapshot = await pointsRef.orderBy('username').get();

			if (!snapshot.empty) {
				response.data = [];
				snapshot.forEach((doc: { id: any; data: () => any; }) => {
					response.data.push(Object.assign(new User('', '', ''), doc.data()));
				  });
			} else {
				response.message = 'No users found.';
			}

		return response;
	}

	public static async deleteData(userId: string): Promise<void> {
		await Fire.database.collection(Fire.collectionId).doc(userId).delete();
	}
}
Fire.initialize();