import { Timestamp } from '@google-cloud/firestore';
import { logger } from './logger.js';
import { Task } from './task.js'

/**
 * Class represents user in the Firestore
 */
export class User {
    slackId: string;
    email: string;
    language: string;
    sneaky: boolean;
    tasks: Task[]

    constructor(slackId: string, email: string, language: string) {
        this.slackId = slackId;
        this.email = email;
        this.language = language;
        this.sneaky = false;
        this.tasks = []
    }

    /**
     * Completes a task by setting current timestamp
     * @param taskId task to mark as completed
     * @returns {boolean} true if the task exists and have been marked as complete, false otherwise
     */
    public completeTask(taskId: string): boolean {

        if(this.tasks.find(t => t.id === taskId) === undefined)
            this.tasks.push(new Task(taskId));

        const task:Task = this.tasks.find(t => t.id === taskId);

        if(task.completedTs !== null) return false;
        task.completedTs = Timestamp.now();
        return true;
    }

    /**
     * Checks if a task has been completed by checking the timestamp
     * @param taskId task to verify
     * @returns {boolean} true if the task has been completed, false otherwise
     */
    public isTaskCompleted(taskId: string): boolean {

        const task = this.tasks.find(t => t.id === taskId)
        if(task === undefined) return false;
        return task.completedTs !== null;
    }
}