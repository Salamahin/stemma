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
    'nav.language': 'Language',
    'nav.exportDefaultName': 'stemma',

    // Common buttons
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.create': 'Create',
    'common.delete': 'Delete',
    'common.add': 'Add',
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
    'about.rule5': 'If the parents you pick already have a family, the new child joins that family instead of a new one being created',
    'about.rule6': 'Deleting a family does not delete its members — it breaks the links between them',
    'about.rule7': 'A person can have several marriages (be a parent in several families), but only one pair of parents — a child belongs to exactly one family',
    'about.rule8': 'Nobody can become their own ancestor: links that would close a loop of parent → child relations are rejected. Marrying a relative, for example a cousin, is allowed',
    'about.rule9': 'You can only use people you are allowed to edit when you create or change a family',
    'about.editingTitle': 'Adding and linking people',
    'about.editingText1': 'Turn on edit mode with the pencil button. When you hover over (or tap) a person or a family, dashed placeholders appear around it: click one to add a spouse, a parent or a child. You can also drag between people and families to link them: drag a person onto a family to make them a parent there, or a family onto a person to make them its child.',
    'about.editingText2': 'A newly added person is always a new person. If the relative is already in the tree, link the existing person by dragging instead of creating a namesake. Quick search finds people by name and tolerates typos, ё/е and Latin/Cyrillic spelling.',
    'about.viewingTitle': 'Reading the tree',
    'about.viewingText': 'Hover over a person to highlight their family line; pin people to keep their lines highlighted. Coloured clouds group people who share a surname. Each person can have a photo and a bio (Markdown is supported). Mark a tree as "Open by default" to see it first after signing in, and export the picture as SVG from the menu.',
    'about.sharingTitle': 'Share your family tree',
    'about.sharingText1': 'You can create an unlimited number of family trees. You can create a family tree from scratch, or you can clone an existing one. In both cases, you will have editing rights for all members of the family tree.',
    'about.sharingText2': 'You can also invite other users to an existing family tree. Open a person\'s card, choose "Share access", enter their Google email and create a link — it is copied to the clipboard. Send it yourself in a messenger or by email; Stemma does not send it. When the recipient opens the link and signs in with that Google account, they can edit that person, their blood relatives and their spouses. You will not be able to edit people created by invited users.',
    'about.sharingWarning': 'Note',
    'about.sharingWarningText': ', authentication in the system is only possible using a Google account. This means that to invite a user, you need to provide their email associated with a Google account. Usually, this is a Gmail address ending with ',
    'about.mcpTitle': 'AI access (MCP)',
    'about.mcpText': 'Stemma runs a Model Context Protocol server, so you can read and edit your trees from an AI assistant like Claude in plain language. Add the connector at https://api.stemma.link/mcp and sign in with the same Google account.',
    'about.problemsTitle': 'Having problems?',
    'about.problemsText': 'It happens, don\'t worry. You can ask a question, file a complaint, or on the contrary, give us a compliment by writing to ',
    'about.problemsEmail': 'email',

    // Landing
    'landing.tagline': 'A free family tree you build together with your relatives.',
    'landing.feature1': 'Draw families and relationships on an interactive canvas.',
    'landing.feature2': 'Invite relatives by link to edit the tree with you.',
    'landing.feature3': 'Read and edit your trees from an AI assistant over MCP.',
    'landing.signInHint': 'Sign in with Google to start your own tree.',

    // Legal
    'legal.privacy': 'Privacy policy',
    'legal.terms': 'Terms of service',

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
    'family.parents': 'Parents',
    'family.children': 'Children',
    'family.noInfo': 'No information',

    // Create/select person

    // Invite modal

    // Remove stemma modal
    'removeStemma.title': 'Delete {name}?',

    // Stats card
    'stats.people': 'people',
    'stats.families': 'families',
    'stats.depth': 'generations',

    // Editor UI
    'addPerson': 'Add person',
    'addChild': 'Add child',
    'addSpouse': 'Add spouse',
    'addParent': 'Add parent',
    'familyGhostAddChild': 'Add child',
    'familyGhostAddSpouse': 'Add spouse',
    'namePlaceholder': 'Name',
    'emptyStemma': 'Tree is empty',
    'emptyStemmaCta': 'Add person',
    'editMode': 'Edit mode',
    'editModeBanner': 'EDIT MODE',
    'signOut': 'Sign out',
    'about': 'About',
    'settings': 'Settings',
    'exportSvg': 'Export SVG',
    'enterEditMode': 'Enter edit mode',
    'exitEditMode': 'Exit edit mode',
    'addPersonFab': 'Add person',
    'newStemma': 'New tree',
    'renameStemma': 'Rename',
    'cloneStemma': 'Clone',
    'deleteStemma': 'Delete',
    'favouriteStemma': 'Open by default',
    'unfavouriteStemma': "Don't open by default",
    'shareAccess': 'Share access',
    'shareTitle': 'Share access to {name}',
    'shareEmailLabel': 'Email',
    'shareEmailHint': 'Recipient must sign in with this Google email',
    'shareCreateLink': 'Create link',
    'shareCreatingLink': 'Creating link…',
    'shareLinkReady': 'Invitation link is ready',
    'shareLinkCopied': 'Invitation link copied to the clipboard',
    'shareLinkCopyFailed': "Couldn't copy automatically — copy the link below by hand",
    'shareCopy': 'Copy',
    'shareSend': 'Send…',
    'shareDone': 'Done',
    'shareStepSend': 'Send this link to {name} yourself — in a messenger or by email. Stemma does not send it.',
    'shareStepSignIn': 'The recipient opens it and signs in with Google as {email}; access is granted right away.',
    'removeFamilyTitle': 'Delete family?',
    'removeFamilyMessage': 'Members stay but lose their links through this family.',
    'removePersonTitle': 'Delete {name}?',
    'removePersonMessage': 'Person is removed from the tree along with their family links.',
    'searchNoResults': 'No people match',
    'linkRoleTitle': 'Add to family as',
    'linkRoleParent': 'Parent',
    'linkRoleChild': 'Child',
    'dissolveFamily': 'Dissolve',
    'dissolveFamilyConfirm': 'Dissolve',
    'tipPersonHasSpouse': '{name} has a spouse',
    'tipPersonHasParents': '{name} has parents',
    'tipParentHasChildren': '{name} has children',
    'tipParentsHaveChildren': '{names} have children',
    'tipChildHasParent': '{name} has a parent',
    'tipChildrenHaveParent': '{names} have a parent',
    'tipIsSpouse': "{person} is {family}'s spouse",
    'tipIsChild': "{person} is {family}'s child",
    'tipIsParent': "{person} is {names}'s parent",
    'namesJoin': ' and ',
    'namesSeparator': ', ',
    'createSpouseTitleOf': "Add {name}'s spouse",
    'createChildTitleOf': 'Add child of {names}',
    'createParentTitleOf': "Add {names}'s parent",
    'panModeOn': 'Pan canvas',
    'panModeOff': 'Exit pan mode',
    'minimap.show': 'Minimap',
};

export const ru: Record<string, string> = {
    // Navbar
    'nav.language': 'Язык',
    'nav.exportDefaultName': 'родословная',

    // Common buttons
    'common.cancel': 'Отмена',
    'common.save': 'Сохранить',
    'common.create': 'Создать',
    'common.delete': 'Удалить',
    'common.add': 'Добавить',
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
    'about.rule5': 'Если у выбранных родителей уже есть семья, новый ребёнок добавляется в неё, а не в новую семью',
    'about.rule6': 'Удаление семьи не удаляет членов этой семьи, а разрывает связи между ними',
    'about.rule7': 'У человека может быть несколько браков (он может быть родителем в нескольких семьях), но только одна пара родителей — ребёнок входит ровно в одну семью',
    'about.rule8': 'Никто не может стать собственным предком: связи, которые замыкают цепочку «родитель → ребёнок» в кольцо, отклоняются. Брак между родственниками, например двоюродными, разрешён',
    'about.rule9': 'При создании или изменении семьи можно использовать только тех людей, которых вам разрешено редактировать',
    'about.editingTitle': 'Добавление и связывание людей',
    'about.editingText1': 'Включите режим редактирования кнопкой с карандашом. Если навести курсор на человека или семью (или коснуться их), вокруг появятся пунктирные заготовки: нажмите на нужную, чтобы добавить супруга, родителя или ребёнка. Людей и семьи можно связывать и перетаскиванием: перетащите человека на семью, чтобы сделать его в ней родителем, или семью на человека, чтобы сделать его её ребёнком.',
    'about.editingText2': 'Добавленный человек всегда создаётся как новый. Если родственник уже есть в древе, свяжите существующего человека перетаскиванием, а не создавайте тёзку. Быстрый поиск находит людей по имени с учётом опечаток, ё/е и написания латиницей или кириллицей.',
    'about.viewingTitle': 'Как читать древо',
    'about.viewingText': 'Наведите курсор на человека, чтобы подсветить его родовую линию; закрепите людей, чтобы их линии оставались подсвеченными. Цветные облака объединяют людей с общей фамилией. У каждого человека может быть фото и биография (поддерживается Markdown). Отметьте древо «Открывать по умолчанию», чтобы видеть его первым после входа, а картинку можно выгрузить в SVG из меню.',
    'about.sharingTitle': 'Делитесь родословной',
    'about.sharingText1': 'Вам доступно создание неограниченного числа родословных. Вы можете создать родословную "с нуля", а можете скопировать уже существующую. В обоих случаях у вас будет права на редактирование всех членов родословной',
    'about.sharingText2': 'Вы также можете пригласить других пользователей в существующую родословную. Откройте карточку человека, выберите «Поделиться доступом», укажите его Google-почту и создайте ссылку — она скопируется в буфер обмена. Отправьте её сами в мессенджере или по почте: Stemma её не отправляет. Когда получатель откроет ссылку и войдёт под этим Google-аккаунтом, он сможет редактировать этого человека, его кровных родственников и их супругов. Людей, созданных приглашёнными пользователями, вы редактировать не сможете.',
    'about.sharingWarning': 'Внимание',
    'about.sharingWarningText': ', аутентификация в системе возможна только с помощью google-аккаунта. Это значит, что для приглашения пользователя необходимо указывать его email, ассоциированный с google-аккаунтом. Обычно, это gmail-почта, которая заканчивается на ',
    'about.mcpTitle': 'Доступ для ИИ (MCP)',
    'about.mcpText': 'У Stemma есть сервер Model Context Protocol — можно читать и редактировать свои деревья из ИИ-ассистента (например, Claude) обычным языком. Добавьте коннектор https://api.stemma.link/mcp и войдите тем же Google-аккаунтом.',
    'about.problemsTitle': 'Возникли проблемы?',
    'about.problemsText': 'Такое бывает, не расстраивайтесь. Можете задать вопрос, пожаловаться, или наоборот, похвалить нас, написав на ',
    'about.problemsEmail': 'почту',

    // Landing
    'landing.tagline': 'Бесплатное генеалогическое древо, которое вы строите вместе с родственниками.',
    'landing.feature1': 'Стройте семьи и связи на интерактивном холсте.',
    'landing.feature2': 'Приглашайте родственников по ссылке — редактируйте древо вместе.',
    'landing.feature3': 'Читайте и редактируйте древа из AI-ассистента по MCP.',
    'landing.signInHint': 'Войдите через Google, чтобы начать своё древо.',

    // Legal
    'legal.privacy': 'Политика конфиденциальности',
    'legal.terms': 'Условия использования',

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
    'family.parents': 'Родители',
    'family.children': 'Дети',
    'family.noInfo': 'Нет информации',

    // Create/select person

    // Invite modal

    // Remove stemma modal
    'removeStemma.title': 'Удалить {name}?',

    // Stats card
    'stats.people': 'людей',
    'stats.families': 'семей',
    'stats.depth': 'поколений',

    // Editor UI
    'addPerson': 'Добавить человека',
    'addChild': 'Добавить потомка',
    'addSpouse': 'Добавить супруга',
    'addParent': 'Добавить родителя',
    'familyGhostAddChild': 'Добавить ребенка',
    'familyGhostAddSpouse': 'Добавить супруга(у)',
    'namePlaceholder': 'Имя',
    'emptyStemma': 'Древо пустое',
    'emptyStemmaCta': 'Добавить человека',
    'editMode': 'Режим редактирования',
    'editModeBanner': 'ПРАВКА',
    'signOut': 'Выйти',
    'about': 'О проекте',
    'settings': 'Настройки',
    'exportSvg': 'Скачать SVG',
    'enterEditMode': 'Включить редактирование',
    'exitEditMode': 'Выключить редактирование',
    'addPersonFab': 'Добавить человека',
    'newStemma': 'Новое древо',
    'renameStemma': 'Переименовать',
    'cloneStemma': 'Клонировать',
    'deleteStemma': 'Удалить',
    'favouriteStemma': 'Открывать по умолчанию',
    'unfavouriteStemma': 'Не открывать по умолчанию',
    'shareAccess': 'Поделиться доступом',
    'shareTitle': 'Поделиться доступом к {name}',
    'shareEmailLabel': 'Email',
    'shareEmailHint': 'Получатель должен войти под этим Google-адресом',
    'shareCreateLink': 'Создать ссылку',
    'shareCreatingLink': 'Создаю ссылку…',
    'shareLinkReady': 'Ссылка-приглашение готова',
    'shareLinkCopied': 'Ссылка-приглашение скопирована в буфер обмена',
    'shareLinkCopyFailed': 'Не удалось скопировать автоматически — скопируйте ссылку ниже вручную',
    'shareCopy': 'Копировать',
    'shareSend': 'Отправить…',
    'shareDone': 'Готово',
    'shareStepSend': 'Отправьте эту ссылку {name} сами — в мессенджере или по почте. Stemma её не отправляет.',
    'shareStepSignIn': 'Получатель открывает её и входит через Google под {email} — доступ появится сразу.',
    'removeFamilyTitle': 'Удалить семью?',
    'removeFamilyMessage': 'Люди останутся, но потеряют связи через эту семью.',
    'removePersonTitle': 'Удалить {name}?',
    'removePersonMessage': 'Человек будет удалён из дерева вместе с его семейными связями.',
    'searchNoResults': 'Никто не найден',
    'linkRoleTitle': 'Добавить в семью как',
    'linkRoleParent': 'Родитель',
    'linkRoleChild': 'Ребёнок',
    'dissolveFamily': 'Разъединить',
    'dissolveFamilyConfirm': 'Разъединить',
    'tipPersonHasSpouse': 'у {name} есть супруг',
    'tipPersonHasParents': 'у {name} есть родители',
    'tipParentHasChildren': 'у {name} есть дети',
    'tipParentsHaveChildren': 'у {names} есть дети',
    'tipChildHasParent': 'у {name} есть родитель',
    'tipChildrenHaveParent': 'у {names} есть родитель',
    'tipIsSpouse': '{person} — супруг {family}',
    'tipIsChild': '{person} — ребёнок {family}',
    'tipIsParent': '{person} — родитель {names}',
    'namesJoin': ' и ',
    'namesSeparator': ', ',
    'createSpouseTitleOf': 'Добавить супруга {name}',
    'createChildTitleOf': 'Добавить ребёнка {names}',
    'createParentTitleOf': 'Добавить родителя {names}',
    'panModeOn': 'Перемещать холст',
    'panModeOff': 'Выйти из режима перемещения',
    'minimap.show': 'Миникарта',
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
