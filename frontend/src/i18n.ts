import { writable, derived } from 'svelte/store';

export type Locale = 'en' | 'ru';
export type TranslationParams = Record<string, string>;

export class LocalizedError extends Error {
    key: string;
    params?: TranslationParams;

    constructor(key: string, params?: TranslationParams) {
        super(key);
        this.key = key;
        this.params = params;
    }
}

const STORAGE_KEY = 'stemma_locale';

export function getInitialLocale(): Locale {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'ru') return stored;
    } catch {}
    return 'en';
}

export const locale = writable<Locale>(getInitialLocale());

locale.subscribe((val) => {
    try {
        localStorage.setItem(STORAGE_KEY, val);
    } catch {}
});

export const en: Record<string, string> = {
    // Navbar
    'nav.familyTrees': 'Family trees',
    'nav.createNew': 'Create new',
    'nav.addFamily': 'Add family',
    'nav.inviteMember': 'Invite member',
    'nav.settings': 'Settings',
    'nav.about': 'About',
    'nav.language': 'Language',

    // Common buttons
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.add': 'Add',
    'common.back': 'Back',
    'common.select': 'Select',
    'common.close': 'Close',
    'common.ok': 'Got it',

    // App
    'app.oops': 'Oops!',
    'app.loading': 'Loading...',

    // Search
    'search.placeholder': 'Quick search',

    // Errors (model.ts)
    'error.sessionExpired': 'Session has expired. Please sign in again (reload the page)',
    'error.unexpectedResponse': 'Received an unexpected response from the server. Try reloading the page',
    'error.unknown': 'Something went wrong. Try reloading the page',
    'error.invalidRequest': 'Invalid request — how did you manage to send that?!',
    'error.noSuchPerson': 'You specified an unknown person {name}, perhaps they have already been deleted?',
    'error.childAlreadyHasParents': '{name} already has parents, you cannot add them to a family',
    'error.incompleteFamily': 'Cannot create a family with fewer than 2 people',
    'error.duplicatedIds': 'Cannot specify the same person {name} in a family twice',
    'error.accessToFamilyDenied': 'Action on the family is forbidden',
    'error.accessToPersonDenied': 'Action on person {name} is forbidden',
    'error.accessToStemmaDenied': 'Action on the family tree is forbidden',
    'error.invalidInviteToken': 'Please check the invitation link',
    'error.foreignInviteToken': 'It seems you are using someone else\'s invitation link',
    'error.stemmaHasCycles': 'Invalid family composition — a cyclic dependency was detected',
    'error.noDescription': '[NO DESCRIPTION]',
    'error.defaultStemmaName': 'My family tree',

    // About modal
    'about.title': 'About the project',
    'about.heading': 'Stemma',
    'about.intro': 'Stemma is a non-commercial project that started as an attempt to collect and organize a large family tree. It soon became clear that gathering information about distant relatives alone is difficult, so we decided to allow everyone to edit the tree together.',
    'about.familyRulesTitle': 'Family and tree-building rules',
    'about.familyRulesIntro': 'A family tree is a set of families and relationships between them. A family consists of children and parents and includes at least two people; it is marked by a small circle. Relationships within a family are shown by directed arrows of different thickness. An arrow pointing from a person to a family indicates a "parent" or "marriage" relationship, while an arrow pointing from a family to a person indicates a "child" relationship.',
    'about.familyRulesNote': 'When adding a family, you need to consider several rules that the system checks automatically:',
    'about.diagram.parent1': 'Parent A',
    'about.diagram.parent2': 'Parent B',
    'about.diagram.family': 'Family',
    'about.diagram.child': 'Child',
    'about.rule1': 'A family consists of parents and children',
    'about.rule2': 'You cannot create a family consisting of only one person',
    'about.rule3': 'You can create a family without parents or without children, as long as it has at least two people',
    'about.rule4': 'There can be no more than two parents, while the number of children is unlimited',
    'about.rule5': 'If the specified parents already have children, the existing family will be updated instead of creating a new one, and the lists of children will be merged',
    'about.rule6': 'Deleting a family does not delete its members — it breaks the links between them',
    'about.rule7': 'A parent can have multiple marriages/families, but children cannot have parents from different marriages',
    'about.rule8': 'You cannot create a cyclic dependency in the tree — in other words, you cannot choose any of your relatives, no matter how distant, as a spouse',
    'about.rule9': 'The system checks editing permissions for each person and will not allow using people whose editing is restricted when creating a family',
    'about.namesakesTitle': 'There may be namesakes',
    'about.namesakesText': 'When creating a family, keep in mind that the system may already contain a person with the specified name — a namesake. In that case, you need to specify whether you want to create a new person (namesake) or add additional family links to an already existing person.',
    'about.sharingTitle': 'Share your family tree',
    'about.sharingText1': 'You can create an unlimited number of family trees. You can create a family tree from scratch, or you can clone an existing one. In both cases, you will have editing rights for all members of the family tree.',
    'about.sharingText2': 'You can also invite other users to an existing family tree. In this case, you will grant the invited users the right to edit information about their blood relatives and their spouses. You will not be able to edit information about people created by invited users. To invite a user, create a personal invitation link for them. The corresponding rights will be granted as soon as the user follows the link.',
    'about.sharingWarning': 'Note',
    'about.sharingWarningText': ', authentication in the system is only possible using a Google account. This means that to invite a user, you need to provide their email associated with a Google account. Usually, this is a Gmail address ending with ',
    'about.problemsTitle': 'Having problems?',
    'about.problemsText': 'It happens, don\'t worry. You can ask a question, file a complaint, or on the contrary, give us a compliment by writing to ',
    'about.problemsEmail': 'email',

    // Person details modal
    'person.title': 'Personal information',
    'person.name': 'Name',
    'person.lifeYears': 'Life years',
    'person.bio': 'Bio',
    'person.pin': 'Pin',
    'person.datePlaceholder': 'dd.mm.yyyy',
    'person.incompleteDate': 'Incomplete date',
    'person.invalidDateRange': 'Invalid date range',

    // Settings modal
    'settings.title': 'Display settings',
    'settings.showAll': 'Show all',
    'settings.showEditableOnly': 'Show only editable',

    // Person selector
    'personSelector.namesake': 'Namesake {index}',
    'personSelector.createNew': 'Create new',

    // Add stemma modal
    'stemma.addTitle': 'Add new family tree',
    'stemma.nameLabel': 'Family tree name',
    'stemma.defaultName': 'My family tree',

    // Clone stemma modal
    'stemma.cloneTitle': 'Clone family tree',
    'stemma.clone': 'Clone',

    // Family details modal
    'family.compositionTitle': 'Family composition',
    'family.selectMemberTitle': 'Select family member',
    'family.parents': 'Parents',
    'family.children': 'Children',
    'family.noInfo': 'No information',

    // Create/select person
    'family.fullName': 'Full name',
    'family.namePlaceholder': 'John Smith',
    'family.createOption': 'Create "{name}"',

    // Invite modal
    'invite.title': 'Invite',
    'invite.user': 'User',
    'invite.email': 'Email address',
    'invite.linkLabel': 'Invitation link',
    'invite.create': 'Create',

    // Remove stemma modal
    'removeStemma.title': 'Delete {name}?',
};

export const ru: Record<string, string> = {
    // Navbar
    'nav.familyTrees': 'Родословные',
    'nav.createNew': 'Создать новую',
    'nav.addFamily': 'Добавить семью',
    'nav.inviteMember': 'Пригласить участника',
    'nav.settings': 'Настройки',
    'nav.about': 'О проекте',
    'nav.language': 'Язык',

    // Common buttons
    'common.cancel': 'Отмена',
    'common.save': 'Сохранить',
    'common.delete': 'Удалить',
    'common.add': 'Добавить',
    'common.back': 'Назад',
    'common.select': 'Выбрать',
    'common.close': 'Закрыть',
    'common.ok': 'Понятно',

    // App
    'app.oops': 'Упс!',
    'app.loading': 'Минуту...',

    // Search
    'search.placeholder': 'Быстрый поиск',

    // Errors (model.ts)
    'error.sessionExpired': 'Сессия успела протухнуть. Авторизуйтесь заново (перезагрузите страницу)',
    'error.unexpectedResponse': 'Получен неожиданный ответ от сервера. Попробуйте перезагрузить страницу',
    'error.unknown': 'Что-то пошло не так. Попробуйте перезагрузить страницу',
    'error.invalidRequest': 'Невалидный запрос, как у тебя удалось-то такой послать вообще?!',
    'error.noSuchPerson': 'Вы указали неизвестного человека {name}, возможно, его уже удалили?',
    'error.childAlreadyHasParents': 'У {name}, уже есть родители, вы не можете добавить его в семью',
    'error.incompleteFamily': 'Нельзя создать семью, в которой меньше 2 людей',
    'error.duplicatedIds': 'Нельзя указать одного и того же человека {name} в семье дважды',
    'error.accessToFamilyDenied': 'Действие с семьей запрещено',
    'error.accessToPersonDenied': 'Действие с человеком {name} запрещено',
    'error.accessToStemmaDenied': 'Действие с родословной запрещено',
    'error.invalidInviteToken': 'Проверьте правильность ссылки-приглашения',
    'error.foreignInviteToken': 'Похоже, вы используете чужую ссылку-приглашение',
    'error.stemmaHasCycles': 'Неверная композиция семьи - обнаружена циклическая зависимость',
    'error.noDescription': '[НЕТ ОПИСАНИЯ]',
    'error.defaultStemmaName': 'Моя родословная',

    // About modal
    'about.title': 'О проекте',
    'about.heading': 'Stemma',
    'about.intro': 'Stemma - некоммерческий проект, который начался с попытки собрать и систематизировать большое генеалогическое дерево. Довольно скоро выяснилось, что в одиночку собирать информацию о дальних родственниках сложно, поэтому мы решили дать возможность редактировать древо всем вместе.',
    'about.familyRulesTitle': 'Семья и правила построения древа',
    'about.familyRulesIntro': 'Родословная - это набор семей и связей между ними. Семья состоит из детей и родителей, и состоит как минимум из двух человек, она обозначается небольшим кругом. Отношения в семье показаны направленными стрелками разной толщины. Стрелка, направленная от человека к семье показывает отношение "родитель" или "брак", а стрелка, направленная из семьи к человеку описывает отношение "ребенок".',
    'about.familyRulesNote': 'При добавлении семьи нужно учитывать несколько правил, которые система автоматически проверяет:',
    'about.diagram.parent1': 'Родитель A',
    'about.diagram.parent2': 'Родитель B',
    'about.diagram.family': 'Семья',
    'about.diagram.child': 'Ребенок',
    'about.rule1': 'Семья состоит из родителей и детей',
    'about.rule2': 'Нельзя создать семью, состоящую из одного человека',
    'about.rule3': 'Можно создать семью без родителей, можно создать семью без детей, главное, чтобы в ней было минимум два человека',
    'about.rule4': 'Не может быть больше двух родителей, тогда как количество детей неограниченно',
    'about.rule5': 'Если у указанных родителей уже есть дети, то вместо создания новой семьи будет обновлена существующая, а списки детей объеденины',
    'about.rule6': 'Удаление семьи не удаляет членов этой семьи, а разрывает связи между ними',
    'about.rule7': 'Родитель может иметь несколько браков-семей, но у детей не может быть родителей из разных браков',
    'about.rule8': 'Нельзя создать циклическую зависимость в древе, другими словами нельзя выбрать кого-то из своих родственников, сколь угодно дальних, в качестве супруга',
    'about.rule9': 'Система проверяет права на редактирование информации о том или ином человеке, и при создании семьи не позволит использовать людей, редактирование которых запрещено',
    'about.namesakesTitle': 'Могут быть тезки',
    'about.namesakesText': 'При создании семьи необходимо учитывать, что система может уже содержать человека с указанным именем - тезку. В таком случае вы должны уточнить, хотите ли вы создать нового человека-тезку, или же добавить уже существующему человеку дополнительные родственные связи.',
    'about.sharingTitle': 'Делитесь родословной',
    'about.sharingText1': 'Вам доступно создание неограниченного числа родословных. Вы можете создать родословную "с нуля", а можете скопировать уже существующую. В обоих случаях у вас будет права на редактирование всех членов родословной',
    'about.sharingText2': 'Вы так же можете пригласить других пользователей в существующую родословную. В этом случае, вы дадите приглашенным права на изменение информации об их кровных родственниках и их супругах. Вы не сможете редактировать информацию о людях, созданных приглашенными пользователями. Чтобы пригласить пользователя, создайте для него персональную ссылку-приглашение. Соответсвующее права будут даны как только пользователь перейдет по ней.',
    'about.sharingWarning': 'Внимание',
    'about.sharingWarningText': ', аутентификация в системе возможна только с помощью google-аккаунта. Это значит, что для приглашения пользователя необходимо указывать его email, ассоциированный с google-аккаунтом. Обычно, это gmail-почта, которая заканчивается на ',
    'about.problemsTitle': 'Возникли проблемы?',
    'about.problemsText': 'Такое бывает, не расстраивайтесь. Можете задать вопрос, пожаловаться, или наоборот, похвалить нас, написав на ',
    'about.problemsEmail': 'почту',

    // Person details modal
    'person.title': 'Персональная информация',
    'person.name': 'Имя',
    'person.lifeYears': 'Годы жизни',
    'person.bio': 'Био',
    'person.pin': 'Закрепить',
    'person.datePlaceholder': 'дд.мм.гггг',
    'person.incompleteDate': 'Неполная дата',
    'person.invalidDateRange': 'Неверный диапазон дат',

    // Settings modal
    'settings.title': 'Настройки отображения',
    'settings.showAll': 'Отображать всех',
    'settings.showEditableOnly': 'Отображать только редактируемых',

    // Person selector
    'personSelector.namesake': 'Тезка {index}',
    'personSelector.createNew': 'Создать нового',

    // Add stemma modal
    'stemma.addTitle': 'Добавить новую родословную',
    'stemma.nameLabel': 'Название родословной',
    'stemma.defaultName': 'Моя родословная',

    // Clone stemma modal
    'stemma.cloneTitle': 'Клонировать родословную',
    'stemma.clone': 'Клонировать',

    // Family details modal
    'family.compositionTitle': 'Состав семьи',
    'family.selectMemberTitle': 'Выбрать члена семьи',
    'family.parents': 'Родители',
    'family.children': 'Дети',
    'family.noInfo': 'Нет информации',

    // Create/select person
    'family.fullName': 'Полное имя',
    'family.namePlaceholder': 'Иванов Иван Иванович',
    'family.createOption': 'Создать "{name}"',

    // Invite modal
    'invite.title': 'Пригласить',
    'invite.user': 'Пользователь',
    'invite.email': 'Email-адрес',
    'invite.linkLabel': 'Ссылка для приглашения',
    'invite.create': 'Создать',

    // Remove stemma modal
    'removeStemma.title': 'Удалить {name}?',
};

const dictionaries: Record<Locale, Record<string, string>> = { en, ru };

export function interpolate(template: string, params?: Record<string, string>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

export type TranslationFn = (key: string, params?: Record<string, string>) => string;

export const t = derived<typeof locale, TranslationFn>(locale, ($locale) => {
    return (key: string, params?: Record<string, string>): string => {
        const dict = dictionaries[$locale];
        const template = dict[key];
        if (!template) return key;
        return interpolate(template, params);
    };
});
