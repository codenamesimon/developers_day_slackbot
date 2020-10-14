import { Bot } from './bot.js';
import { logger } from './logger.js';
import { Fire } from './firestore.js';
import { User } from './user';
import { Slack } from './slack.js'
import { Secrets } from './secrets.js'
import { Task } from './task.js';
import { Timestamp } from '@google-cloud/firestore';

export class Rexor extends Bot {

    private static responsesPolish: Map<string, string> = new Map<string, string>([
        ['lang_switch', "No to po polsku!"],
        ['help', "Czy nasz osoby które znajdują się na obrazku?. Wyślij wszystkie osoby do mnie w jednej wiadomości używając ich @ np. %s. Spośród osób, które odgadną wszytskie osoby prawidłowo, wylosujemy specjalne nagrody. \n\n- Odpisz `status`, żeby dowiedzieć się, jak dobrze Ci idzie.\n- Odpisz `rezygnuje`, żeby zrezygnować z konkursu i usunąć wszstkie swoje dane.\n- For English - reply `english please`. :flag-gb:"],
        ['bad_response', "Niestety nie brzmi to jak odpowiedź, której szukamy :disappointed:. Nie wiesz, co robić? Możesz zawsze zapytać się mnie o `pomoc`. \n\nFor english - reply `English please`. :flag-gb:"],
        ['riddle_1_solved', "Brawo! :tada: Udało Ci się rozwiązać zagadkę :tada:! Liczba prób: %d."],
        ['riddle_1_partial', "No niestety nie udało Ci się odgadnąć wszytskich osób dobrze, jedynie %d z %d! Próbuj dalej."],
        ['riddle_1_cpl', "Już rozwiązałeś naszą zagadkę próbując zaledwie %d razy! Teraz tylko czekamy na wyniki!"],
        ['status', "Mimo %d prób, nie udało Ci się rozwiązać jeszcze zagadki!"],
        ['withdrawal', "Rozumiem! Usunąłem dane o Tobie. Szkoda, że rezygnujesz z zabawy. Jeśli zdecydujesz się dołączyć jeszcze raz, wystarczy, że do mnie napiszesz. Niestety odpowiedzi na zagadki będą musiały być wysłane jeszcze raz. :wave:"]
    ]);

    private static responsesEnglish: Map<string, string> = new Map<string, string>([
        ['lang_switch', "Alright, let's talk in English then!"],
        ['help', "Send me answers to the puzzles which are posted on #general. The people who will get all of the proper answers the fastest will win special rewards!\n\n- Reply `status` to check on your progress.\n- Reply `withdraw` to resign and delete all your data.\n- Odpisz `polski`, żeby porozmawiać po polsku :flag-pl:"],
        ['bad_response', "Unfortunately it doesn't look like the answer we're looking for :disappointed:. Don't know what to do? You can always ask me for `help`. \n\nOdpisz `polski`, żeby porozmawiać po polsku :flag-pl:"],
        ['riddle_1_solved', "Congratulations! You've solved the Monday's riddle! So far you've solved %d out of %d ridles! :tada:"],
        ['riddle_1_partial', "No niestety nie udało Ci się odgadnąć wszytskich osób dobrze, jedynie %d z %d! Próbuj dalej."],
        ['riddle_1_cpl', "This riddle has already been solved by you!"],
        ['status', "Your progress is %d out of %d riddles done!\n\n%s Monday\n%s Tuesday\n%s Wednesday\n%s Thursday\n%s Friday"],
        ['withdrawal', "Understood! I've deleted all of your data! It's a shame that you've resigned. If you'd like to re-join just send me any message. You will need to send answers to all riddles again though! :wave:"]
    ]);

    /** @inheritdoc */
    protected getOauthTokenId(): string {
        return 'slack-bot-oaut-token';
    }

    /** @inheritdoc */
    protected getSigningSecretId(): string {
        return 'slack-signing-secret';
    }

    /** @inheritdoc */
    protected processCommand(message: string, channelId: string, userId: string, responseUrl: string, threadTs: string): void {
        if (threadTs) {
            this.postMessageInThread(message, channelId, threadTs);
        }
        else {
            this.postMessageAsResponse(message, responseUrl, false);
        }
    }

    /** @inheritdoc */
    protected async processDirectMessage(text: string, userId: string, channelId: string): Promise<void> {

        logger.info(`user ${userId} on channel ${channelId} with message ${text}`);

        const parsableMessage = Rexor.removeDiacritics(text.toLowerCase());
        let personData: User = await Fire.getUser(userId);

        if (!personData) {

            logger.info('user not found')
            const profile = await Slack.SendUrlEncoded({ user: userId }, 'users.info', this.getOauthTokenId());
            personData = new User(userId, profile.user.profile.email, 'pl');

            await Fire.upsertData(personData);
        }

        let switchLanguage = false;

        if (parsableMessage.includes('english') && parsableMessage.includes('please')) switchLanguage = true;
        if (parsableMessage.includes('polski')) switchLanguage = true;

        if (switchLanguage) {
            logger.info('switch language. current: ' + personData.language);
            personData.language = personData.language === 'pl' ? 'en' : 'pl';
            await Fire.upsertData(personData);
        }

        const dictionary: Map<string, string> = personData.language === 'pl' ? Rexor.responsesPolish : Rexor.responsesEnglish;
        if (switchLanguage) {
            this.replyWithMessage(dictionary.get('lang_switch'), channelId);
            return
        }

        const sprintf = require('sprintf-js').sprintf;

        const helpKeywords = ['pomoc', 'pomoze', 'pomaga', 'help'];
        if (helpKeywords.some(s => parsableMessage.includes(s))) {

            const exampleUserId = await Secrets.getSecret('example-user-id')
            const reply = sprintf(dictionary.get('help'), exampleUserId);
            this.replyWithMessage(reply, channelId);
            return
        }

        const withdrawKeywords = ['rezygnuje', 'withdraw'];
        if (withdrawKeywords.some(s => parsableMessage.includes(s))) {
            await Fire.deleteData(userId);
            this.replyWithMessage(dictionary.get('withdrawal'), channelId);
            return
        }

        // Fetch task data
        const taskId = 'task1';
        let taskData = personData.tasks.find(t => t.id === taskId);
        logger.info('task data', taskData)
        if (!taskData) {
            logger.info('adding new task data');
            taskData = new Task(taskId);
            personData.tasks.push(taskData);
        }

        const statusKeywords = ['status', 'progres', 'info'];
        if (statusKeywords.some(s => parsableMessage.includes(s))) {

            if (taskData.completedTs) {
                logger.info('already completed');
                const reply = sprintf(dictionary.get('riddle_1_cpl'), taskData.attempts);
                this.replyWithMessage(reply, channelId);
                return;
            }

            const statusReply = sprintf(dictionary.get('status'), taskData.attempts);
            this.replyWithMessage(statusReply, channelId);
            return;
        }

        // Check if already solved the riddle
        if (taskData.completedTs) {
            logger.info('already completed');
            const reply = sprintf(dictionary.get('riddle_1_cpl'), taskData.attempts);
            this.replyWithMessage(reply, channelId);
            return;
        }
        // let solvedRiddles = Array.from(personData.tasks.values()).filter(p => p.completedTs).length;

        const correctAnswersRaw: string = await Secrets.getSecret('edition-2-answer');
        const correctAnswers = correctAnswersRaw.split(',');

        let correctGuesses = 0;
        correctAnswers.forEach(answer => {
            if (new RegExp(`@${answer}`).test(text)) {
                correctGuesses++;
            }
        });

        const userIdInMessage = /<@.+>/.test(text);

        if (correctGuesses === correctAnswers.length) {
            // tada
            taskData.attempts++;
            taskData.completedTs = Timestamp.now();
            const reply = sprintf(dictionary.get('riddle_1_solved'), taskData.attempts);
            this.replyWithMessage(reply, channelId);
            await Fire.upsertData(personData);
        } else if (correctGuesses === 0 && !userIdInMessage) {
            // No guesses and no users in message
            this.replyWithMessage(dictionary.get('bad_response'), channelId);
        }
        else {
            logger.info('something in between')
            // somethin in between
            taskData.attempts++;
            const reply = sprintf(dictionary.get('riddle_1_partial'), correctGuesses, correctAnswers.length, taskData.attempts);
            this.replyWithMessage(reply, channelId);
            await Fire.upsertData(personData);
        }
        return;
    }
}