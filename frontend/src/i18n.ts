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
    'nav.export': 'Export SVG',
    'nav.exportDefaultName': 'stemma',

    // Common buttons
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.create': 'Create',
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
    'error.unsupportedPhotoType': 'Unsupported photo format. Please use JPEG, PNG, or WebP',
    'error.ambiguousLinkTarget': '{name} belongs to more than one family — pick a specific one to add to',
    'error.spouseLinkAlreadyExists': 'These two are already spouses in an existing family',
    'error.tooManyParents': 'A family cannot have more than two parents',
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
    'person.bioEdit': 'Edit',
    'person.bioPreview': 'Preview',
    'person.bioMarkdownHint': 'Markdown supported (headings, lists, **bold**, *italic*, [links](url))',
    'person.bioEmpty': 'No bio',
    'person.pin': 'Pin',
    'person.datePlaceholder': 'dd.mm.yyyy',
    'person.incompleteDate': 'Incomplete date',
    'person.invalidDateRange': 'Invalid date range',
    'person.photo': 'Photo',
    'person.photoUpload': 'Upload photo',
    'person.photoReplace': 'Replace photo',
    'person.photoRemove': 'Remove photo',
    'person.photoTooLarge': 'Photo is too large (max 5 MB)',
    'person.photoUnsupportedType': 'Unsupported photo format. Use JPEG, PNG, or WebP',
    'person.photoUploadFailed': 'Photo upload failed. Try again',
    'person.photoAdjustTitle': 'Adjust photo',
    'person.photoAdjustHint': 'Drag to position, use the slider to zoom',
    'person.unknown': 'Unknown',
    'person.unknownToggle': 'Unknown person',

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
    'stemma.kingsOfEuropeName': 'European Kings',

    // Clone stemma modal
    'stemma.cloneTitle': 'Clone family tree',
    'stemma.clone': 'Clone',

    // Rename stemma modal
    'stemma.renameTitle': 'Rename family tree',
    'stemma.rename': 'Rename',

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

    // Stats card
    'stats.people': 'people',
    'stats.families': 'families',
    'stats.depth': 'generations',
    'stats.highlighted': 'highlighted',

    // V2 UI
    'v2.editToggle': 'Edit',
    'v2.addPerson': 'Add person',
    'v2.addChild': '+ child',
    'v2.addSpouse': '+ spouse',
    'v2.anchorAsParent': 'Anchor as parent',
    'v2.anchorAsChild': 'Anchor as child',
    'v2.personGhostLabel': 'Add family',
    'v2.familyGhostAddChild': 'Add child',
    'v2.familyGhostAddSpouse': 'Add spouse',
    'v2.namePlaceholder': 'Name',
    'v2.emptyStemma': 'Tree is empty',
    'v2.emptyStemmaCta': 'Add person',
    'v2.personActions': 'Person actions',
    'v2.familyActions': 'Family actions',
    'v2.selectExisting': 'Select existing',
    'v2.createNew': 'Create new',
    'v2.stubFamily': 'New family (not saved)',
    'v2.editMode': 'Edit mode',
    'v2.editModeBanner': 'EDIT MODE',
    'v2.signOut': 'Sign out',
    'v2.about': 'About',
    'v2.settings': 'Settings',
    'v2.exportSvg': 'Export SVG',
    'v2.enterEditMode': 'Enter edit mode',
    'v2.exitEditMode': 'Exit edit mode',
    'v2.addPersonFab': 'Add person',
    'v2.invite': 'Invite',
    'v2.manageStemmas': 'Manage trees',
    'v2.newStemma': 'New tree',
    'v2.renameStemma': 'Rename',
    'v2.cloneStemma': 'Clone',
    'v2.deleteStemma': 'Delete',
    'v2.copyLink': 'Copy',
    'v2.linkCopied': 'Copied',
    'v2.invitePickPerson': 'Select a person to invite',
    'v2.noInviteLink': 'Generate to get a link',
    'v2.share': 'Share',
    'v2.shareAccess': 'Share access',
    'v2.shareTitle': 'Share access to {name}',
    'v2.shareEmailLabel': 'Email',
    'v2.shareEmailHint': 'Recipient must sign in with this Google email',
    'v2.shareCreateLink': 'Create link',
    'v2.removeFamilyTitle': 'Delete family?',
    'v2.removeFamilyMessage': 'Members stay but lose their links through this family.',
    'v2.removePersonTitle': 'Delete {name}?',
    'v2.removePersonMessage': 'Person is removed from the tree along with their family links.',
    'v2.searchNoResults': 'No people match',
    'v2.tray.title': 'Unconnected people',
    'v2.tray.placeholder': 'One name per line',
    'v2.tray.addAll': 'Add all',
    'v2.tray.empty': 'Drag chips onto the canvas to connect',
    'v2.tray.dragHint': 'Drag onto a person',
    'v2.tray.open': 'Open quick-add tray',
    'v2.tray.close': 'Close quick-add tray',
    'v2.linkRoleTitle': 'Add to family as',
    'v2.linkRoleSpouse': 'Spouse',
    'v2.linkRoleParent': 'Parent',
    'v2.linkRoleChild': 'Child',
    'v2.dissolveFamily': 'Dissolve',
    'v2.dissolveFamilyConfirm': 'Dissolve',
    'v2.tipCreateSpouse': 'Create spouse',
    'v2.tipCreateChild': 'Create child',
    'v2.tipCreateFamily': 'Create family',
    'v2.tipAttachSpouse': 'Attach as spouse',
    'v2.tipAttachChild': 'Attach as child',
    'v2.createSpouseTitle': 'Add spouse',
    'v2.createChildTitle': 'Add child',
    'v2.panModeOn': 'Pan canvas',
    'v2.panModeOff': 'Exit pan mode',
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
    'nav.export': 'Скачать SVG',
    'nav.exportDefaultName': 'родословная',

    // Common buttons
    'common.cancel': 'Отмена',
    'common.save': 'Сохранить',
    'common.create': 'Создать',
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
    'error.unsupportedPhotoType': 'Неподдерживаемый формат фото. Используйте JPEG, PNG или WebP',
    'error.ambiguousLinkTarget': '{name} состоит больше чем в одной семье — выберите конкретную, куда добавить',
    'error.spouseLinkAlreadyExists': 'Эти двое уже супруги в существующей семье',
    'error.tooManyParents': 'У семьи не может быть больше двух родителей',
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
    'person.bioEdit': 'Редактировать',
    'person.bioPreview': 'Просмотр',
    'person.bioMarkdownHint': 'Поддерживается Markdown (заголовки, списки, **жирный**, *курсив*, [ссылки](url))',
    'person.bioEmpty': 'Нет био',
    'person.pin': 'Закрепить',
    'person.datePlaceholder': 'дд.мм.гггг',
    'person.incompleteDate': 'Неполная дата',
    'person.invalidDateRange': 'Неверный диапазон дат',
    'person.photo': 'Фото',
    'person.photoUpload': 'Загрузить фото',
    'person.photoReplace': 'Заменить фото',
    'person.photoRemove': 'Удалить фото',
    'person.photoTooLarge': 'Фото слишком большое (макс. 5 МБ)',
    'person.photoUnsupportedType': 'Неподдерживаемый формат фото. Используйте JPEG, PNG или WebP',
    'person.photoUploadFailed': 'Не удалось загрузить фото. Попробуйте еще раз',
    'person.photoAdjustTitle': 'Подгонка фото',
    'person.photoAdjustHint': 'Двигайте мышью, масштабируйте ползунком',
    'person.unknown': 'Неизвестно',
    'person.unknownToggle': 'Неизвестный',

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
    'stemma.kingsOfEuropeName': 'Короли Европы',

    // Clone stemma modal
    'stemma.cloneTitle': 'Клонировать родословную',
    'stemma.clone': 'Клонировать',

    // Rename stemma modal
    'stemma.renameTitle': 'Переименовать родословную',
    'stemma.rename': 'Переименовать',

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

    // Stats card
    'stats.people': 'людей',
    'stats.families': 'семей',
    'stats.depth': 'поколений',
    'stats.highlighted': 'подсвечено',

    // V2 UI
    'v2.editToggle': 'Редактировать',
    'v2.addPerson': 'Добавить человека',
    'v2.addChild': '+ ребенок',
    'v2.addSpouse': '+ супруг(а)',
    'v2.anchorAsParent': 'Привязать как родителя',
    'v2.anchorAsChild': 'Привязать как ребенка',
    'v2.personGhostLabel': 'Добавить семью',
    'v2.familyGhostAddChild': 'Добавить ребенка',
    'v2.familyGhostAddSpouse': 'Добавить супруга(у)',
    'v2.namePlaceholder': 'Имя',
    'v2.emptyStemma': 'Древо пустое',
    'v2.emptyStemmaCta': 'Добавить человека',
    'v2.personActions': 'Действия',
    'v2.familyActions': 'Действия с семьей',
    'v2.selectExisting': 'Выбрать существующего',
    'v2.createNew': 'Создать нового',
    'v2.stubFamily': 'Новая семья (не сохранена)',
    'v2.editMode': 'Режим редактирования',
    'v2.editModeBanner': 'РЕЖИМ ПРАВКИ',
    'v2.signOut': 'Выйти',
    'v2.about': 'О проекте',
    'v2.settings': 'Настройки',
    'v2.exportSvg': 'Скачать SVG',
    'v2.enterEditMode': 'Включить редактирование',
    'v2.exitEditMode': 'Выключить редактирование',
    'v2.addPersonFab': 'Добавить человека',
    'v2.invite': 'Пригласить',
    'v2.manageStemmas': 'Управление деревьями',
    'v2.newStemma': 'Новое древо',
    'v2.renameStemma': 'Переименовать',
    'v2.cloneStemma': 'Клонировать',
    'v2.deleteStemma': 'Удалить',
    'v2.copyLink': 'Копировать',
    'v2.linkCopied': 'Скопировано',
    'v2.invitePickPerson': 'Выберите человека для приглашения',
    'v2.noInviteLink': 'Создайте, чтобы получить ссылку',
    'v2.share': 'Поделиться',
    'v2.shareAccess': 'Поделиться доступом',
    'v2.shareTitle': 'Поделиться доступом к {name}',
    'v2.shareEmailLabel': 'Email',
    'v2.shareEmailHint': 'Получатель должен войти под этим Google-адресом',
    'v2.shareCreateLink': 'Создать ссылку',
    'v2.removeFamilyTitle': 'Удалить семью?',
    'v2.removeFamilyMessage': 'Люди останутся, но потеряют связи через эту семью.',
    'v2.removePersonTitle': 'Удалить {name}?',
    'v2.removePersonMessage': 'Человек будет удалён из дерева вместе с его семейными связями.',
    'v2.searchNoResults': 'Никто не найден',
    'v2.tray.title': 'Несвязанные люди',
    'v2.tray.placeholder': 'По одному имени на строку',
    'v2.tray.addAll': 'Добавить всех',
    'v2.tray.empty': 'Перетащите карточки на холст, чтобы связать',
    'v2.tray.dragHint': 'Перетащите на человека',
    'v2.tray.open': 'Открыть панель быстрого добавления',
    'v2.tray.close': 'Закрыть панель быстрого добавления',
    'v2.linkRoleTitle': 'Добавить в семью как',
    'v2.linkRoleSpouse': 'Супруг(а)',
    'v2.linkRoleParent': 'Родитель',
    'v2.linkRoleChild': 'Ребёнок',
    'v2.dissolveFamily': 'Разъединить',
    'v2.dissolveFamilyConfirm': 'Разъединить',
    'v2.tipCreateSpouse': 'Создать супруга',
    'v2.tipCreateChild': 'Создать потомка',
    'v2.tipCreateFamily': 'Создать семью',
    'v2.tipAttachSpouse': 'Присоединить супруга',
    'v2.tipAttachChild': 'Присоединить потомка',
    'v2.createSpouseTitle': 'Добавить супруга',
    'v2.createChildTitle': 'Добавить потомка',
    'v2.panModeOn': 'Перемещать холст',
    'v2.panModeOff': 'Выйти из режима перемещения',
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
