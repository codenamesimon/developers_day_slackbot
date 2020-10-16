import { Timestamp } from "@google-cloud/firestore";

/**
 * Class representing a status of a single task of the user
 */
export class Task {
    id: string;
    attempts: number;
    completedTs: Timestamp;
    guesses: string[];

    constructor(id: string) {
        this.id = id;
        this.attempts = 0;
        this.completedTs = null;
        this.guesses = [];
    }
}