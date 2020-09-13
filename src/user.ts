export class User {
    slackId: string;
    username: string;
    language: string;
    points: { task: string, timestamp: string }[];

    constructor(slackId: string, username: string, language: string) {
        this.slackId = slackId;
        this.username = username;
        this.language = language;
        this.points = [];

        for (let i = 1; i <= 5; i++) {
            this.points.push({ task: 'task' + i, timestamp: null });
        }
    }

    /**
     * Completes a task by setting current timestamp
     * @param taskId task to mark as completed
     * @returns {boolean} true if the task exists and have been marked as complete, false otherwise
     */
    public completeTask(taskId: string): boolean {
        const point = this.points.find(element => element.task === taskId);
        if (point) {
            point.timestamp = new Date().toLocaleString();
            return true;
        }

        return false;
    }

    /**
     * Checks if a task has been completed by checking the timestamp
     * @param taskId task to verify
     * @returns {boolean} true if the task has been completed, false otherwise
     */
    public isTaskCompleted(taskId: string): boolean {

        const point = this.points.find(element => element.task === taskId);
        const completed = point?.timestamp != null;

        return completed;
    }
}