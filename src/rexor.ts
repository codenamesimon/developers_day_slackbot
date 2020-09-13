import { Bot } from './bot.js';
import { logger } from './logger.js';
import { Fire } from './firestore.js';
import { User } from './user';
import { Slack } from './slack.js'

export class Rexor extends Bot {

    private static responsesPolish: Map<string, string> = new Map<string, string>([
        ['lang_switch', "No to po polsku!"],
        ['help', "Wysyłaj mi odpowiedzi na zagadki które pojawiają się na #general. Osoby które najszybciej rozwiążą wszytski zagadki wygrają specjalne nagrody. \n\n- Odpisz `status` żeby dowiedzieć się jak dobrze Ci idzie.\n- Odpisz `rezygnuje` żeby zrezygnować z konkursu i usunąć wszstkie swoje dane.\n- For english - reply `english please`. :flag-gb:"],
        ['bad_response', "Niestety nie brzmi to jak odpowiedź, której szukamy :disappointed:. Nie wiesz co robić? Możesz zawsze zapytać się mnie o `pomoc`. \n\nFor english - reply `english please`. :flag-gb:"],
        ['riddle_1', "Brawo! Rozwiązałeś poniedziałkową zagadkę! Rozwiązałeś już %d z %d zagadek! :tada:"],
        ['riddle_1_cpl', "Ta zagadka została już przez Ciebie rozwiązana!"],
        ['status', "Twój obecny postęp to %d na %d zagadek!\n\n %s Poniedziałek\n %s Wtorek\n %s Środa\n %s Czwartek\n %s Piątek"],
        ['withdrawal', "Rozumiem! Usunąłem dane o Tobie. Szkoda, że rezygnujesz z zabawy. Jeśli zdecydujesz się dołączyć jeszcze raz, wystarczy że do mnie napiszesz. Niestety odpowiedzi na zagadki będą musiały być wysłane jeszcze raz. :wave:"]
    ]);

    private static responsesEnglish: Map<string, string> = new Map<string, string>([
        ['lang_switch', "Alright, let's talk in english then!"],
        ['help', "Send answers to the puzzles which are posted on #general. The fastest people who will get all of the answers right will win special rewards!\n\n- Reply `status` to check on your progress.\n- Reply `withdraw` to resign and delete all your data.\n- Odpisz `polski`, żeby porozmawiać po polsku. :flag-pl:"],
        ['bad_response', "Unfortunately it doesn't look like an answer we're looking for :disappointed:. Don't know what to do? You can always ask me for `help`. \n\nOdpisz `polski`, żeby porozmawiać po polsku. :flag-pl:"],
        ['riddle_1', "Congtatulations! You've solved the Monday's riddle! So far you've solved %d out of %d ridles! :tada:"],
        ['riddle_1_cpl', "This riddle has already been solved by you!"],
        ['status', "Your progress is %d out of %d riddles done!\n\n%s Monday\n%s Tuesday\n%s Wednesday\n%s Thursday\n%s Friday"],
        ['withdrawal', "Understood! I've deleted all data about you! It's a shame that you've resigned. If u'd like to re-join just send me any message. You will need to send answers to all riddles again though! :wave:"]
    ]);

    protected getOauthToken(): string {
        return 'slack-bot-oaut-token';
    }

    protected getSigningSecret(): string {
        return 'slack-signing-secret';
    }

    protected processCommand(message: string, channelId: string, userId: string, responseUrl: string, threadTs: string): void {
        if (threadTs) {
            this.postMessageInThread(message, channelId, threadTs);
        }
        else {
            this.postMessageAsResponse(message, responseUrl, false);
        }
    }

	/**
	 * Process a message from a user.
	 * @param text Text that was sent to the bot
	 * @param userId Id of the user
	 * @param channelId Id of the conversation
	 */
    public async processDirectMessage(text: string, userId: string, channelId: string): Promise<void> {

        logger.info(`user ${userId} on channel ${channelId} with message ${text}`);

        const parsableMessage = Rexor.removeDiacritics(text.toLowerCase());

        const personDataRaw: any = await Fire.getData(userId);
        let personData: User = personDataRaw.data;

        if (!personData) {

            logger.info('user not found')
            const profile = await Slack.SendUrlEncoded({ user: userId }, 'users.info', this.getOauthToken());
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

        const helpKeywords = ['pomoc', 'pomoze', 'pomaga', 'help'];
        if (helpKeywords.some(s => parsableMessage.includes(s))) {
            this.replyWithMessage(dictionary.get('help'), channelId);
            return
        }

        const withdrawKeywords = ['rezygnuje', 'withdraw'];
        if (withdrawKeywords.some(s => parsableMessage.includes(s))) {
            await Fire.deleteData(userId);
            this.replyWithMessage(dictionary.get('withdrawal'), channelId);
            return
        }

        const sprintf = require('sprintf-js').sprintf;
        let solvedRiddles = personData.points.filter(p => p.timestamp).length;

        const statusKeywords = ['status', 'progres', 'zadani', 'task', 'info'];
        if (statusKeywords.some(s => parsableMessage.includes(s))) {

            const reply = sprintf(dictionary.get('status'), solvedRiddles, 5,
                personData.isTaskCompleted('task1') ? ':heavy_check_mark:' : ':x:',
                personData.isTaskCompleted('task2') ? ':heavy_check_mark:' : ':grey_question:',
                personData.isTaskCompleted('task3') ? ':heavy_check_mark:' : ':grey_question:',
                personData.isTaskCompleted('task4') ? ':heavy_check_mark:' : ':grey_question:',
                personData.isTaskCompleted('task5') ? ':heavy_check_mark:' : ':grey_question:');

            this.replyWithMessage(reply, channelId);
            return
        }

        if (/\b2[., ]?9[., ]?1[., ]?4[., ]?9[., ]?1[., ]?7\b/.test(parsableMessage)) {

            const taskId: string = "task1";

            if (personData.isTaskCompleted(taskId)) {
                this.replyWithMessage(dictionary.get('riddle_1_cpl'), channelId);
            }
            else {
                solvedRiddles++;
                this.replyWithMessage(sprintf(dictionary.get('riddle_1'), solvedRiddles, 5), channelId);
                personData.completeTask(taskId);
                await Fire.upsertData(personData);
            }
            return;
        }

        this.replyWithMessage(dictionary.get('bad_response'), channelId);
        return
    }

    /**
     * Replace polish diacritics with input string
     * @param input Input string
     */
    private static removeDiacritics(input: string): string {
        return input.replace('ą', 'a')
            .replace('ć', 'c')
            .replace('ę', 'e')
            .replace('ł', 'l')
            .replace('ó', 'o')
            .replace('ś', 's')
            .replace('ż', 'z')
            .replace('ź', 'z');
    }
}