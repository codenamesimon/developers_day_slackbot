/**
 * Manage, add, fetch secrets
 */
export class Secrets {

    /**
     * Fectes the secret from GCP secret manager
     * @param secretId identifier of the requested secret
     */
	public static async getSecret (secretId:string): Promise<string> {

		const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
		const client = new SecretManagerServiceClient();

		const [version] = await client.accessSecretVersion({
			name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/${secretId}/versions/latest`
		});

		const payload = version.payload.data.toString('utf8');
		return payload;
	}
}