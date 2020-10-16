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
        ['help', "Czy nasz osoby które znajdują się na obrazku?. Wyślij @handle wszytskich osób na obrazku do mnie w jednej wiadomości. (np. %s). Wygrywają pierwsze trzy osoby, które podadzą mi prawidłowe odpowiedzi! \n\n- Odpisz `status`, żeby dowiedzieć się, jak dobrze Ci idzie.\n- Odpisz `rezygnuje`, żeby zrezygnować z konkursu i usunąć wszstkie swoje dane.\n- For English - reply `english please`. :flag-gb:"],
        ['bad_response', "Niestety nie brzmi to jak odpowiedź, której szukamy :disappointed:. Nie wiesz, co robić? Możesz zawsze zapytać się mnie o `pomoc`. \n\nFor english - reply `English please`. :flag-gb:"],
        ['riddle_1_solved', "Brawo! :tada: Udało Ci się rozwiązać zagadkę :tada:! Liczba prób: %d."],
        ['riddle_1_partial', "No niestety nie udało Ci się odgadnąć wszytskich osób dobrze, jedynie %d z %d! Próbuj dalej."],
        ['riddle_1_cpl', "Już rozwiązałeś naszą zagadkę próbując zaledwie %d razy! Teraz tylko czekamy na wyniki!"],
        ['not_enough_handles', "Szukamy @handle %d ludzi. Musisz wypisać wszytskich w jednej wiadomości."],
        ['too_many_handles', "Szukamy @handle %d ludzi, a nie %d <: Nie ma oszukiwania! <:"],
        ['status', "Mimo %d prób, nie udało Ci się rozwiązać jeszcze zagadki!"],
        ['withdrawal', "Rozumiem! Usunąłem dane o Tobie. Szkoda, że rezygnujesz z zabawy. Jeśli zdecydujesz się dołączyć jeszcze raz, wystarczy, że do mnie napiszesz. Niestety odpowiedzi na zagadki będą musiały być wysłane jeszcze raz. :wave:"]
    ]);

    private static responsesEnglish: Map<string, string> = new Map<string, string>([
        ['lang_switch', "Alright, let's talk in English then!"],
        ['help', "Do you recognize all the people on the picture? Send me @handles of all of them in one message (like %s). The three fastest contestants will win prizes!\n\n- Reply `status` to check on your progress.\n- Reply `withdraw` to resign and delete all your data.\n- Odpisz `polski`, żeby porozmawiać po polsku :flag-pl:"],
        ['bad_response', "Unfortunately it doesn't look like the answer we're looking for :disappointed:. Don't know what to do? You can always ask me for `help`. \n\nOdpisz `polski`, żeby porozmawiać po polsku :flag-pl:"],
        ['riddle_1_solved', "Congratulations! :tada: U've guessed all the people correctly in %d attempts! :tada:"],
        ['riddle_1_partial', "Unfortunately you've correctly guessed only %d out of %d on the picture! Keep trying!."],
        ['riddle_1_cpl', "You've already solved the riddle in only %d attempts."],
        ['not_enough_handles', "We're looking for @handles of %d people. You need to send all of them in one message to count!"],
        ['too_many_handles', "We're looking for @handles of %d people, not %d <: No cheating! <:"],
        ['status', "Despite %d attempts you haven't managed to solve the riddle yet."],
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

        if (!taskData) {
            logger.info('adding new task data');
            taskData = new Task(taskId);
            personData.tasks.push(taskData);
        }

        if(!taskData.guesses) taskData.guesses = [];
        logger.info('task data', taskData)

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

        const handles = text.match(/<@U\w+>/g);
        const handlesCount = handles?.length ?? 0;

        if (handlesCount < correctAnswers.length) {
            taskData.attempts++;

            handles?.forEach(element => {
                if(!taskData.guesses.find(e => e === element))
                    taskData.guesses.push(element);
            });

            const reply = sprintf(dictionary.get('not_enough_handles'), correctAnswers.length);
            this.replyWithMessage(reply, channelId);
            await Fire.upsertData(personData);
        }
        else if (handlesCount > correctAnswers.length) {
            taskData.attempts++;
            handles?.forEach(element => {
                if(!taskData.guesses.find(e => e === element))
                    taskData.guesses.push(element);
            });
            personData.sneaky = true;
            const reply = sprintf(dictionary.get('too_many_handles'), correctAnswers.length, handlesCount);
            this.replyWithMessage(reply, channelId);
            await Fire.upsertData(personData);
        }
        else if (handlesCount === 0) {
            this.replyWithMessage(dictionary.get('bad_response'), channelId);
        }
        else {
            if (correctGuesses === correctAnswers.length) {
                // tada
                taskData.attempts++;
                handles?.forEach(element => {
                    if(!taskData.guesses.find(e => e === element))
                        taskData.guesses.push(element);
                });
                taskData.completedTs = Timestamp.now();
                const reply = sprintf(dictionary.get('riddle_1_solved'), taskData.attempts);
                this.replyWithMessage(reply, channelId);
                await Fire.upsertData(personData);
            }
            else {
                // somethin in between
                taskData.attempts++;
                handles?.forEach(element => {
                    if(!taskData.guesses.find(e => e === element))
                        taskData.guesses.push(element);
                });
                const reply = sprintf(dictionary.get('riddle_1_partial'), correctGuesses, correctAnswers.length, taskData.attempts);
                this.replyWithMessage(reply, channelId);
                await Fire.upsertData(personData);
            }
        }
    }
}