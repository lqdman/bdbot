// const TelegramBot = require('node-telegram-bot-api');
// const fs = require('fs');
// const axios = require('axios');
// require('dotenv').config(); // Загружаем переменные окружения из файла .env

// // Получаем токен бота из переменных окружения
// const token = process.env.TELEGRAM_BOT_TOKEN;

// if (!token) {
//   throw new Error('Telegram Bot Token not provided!');
// }

// // Добавьте идентификатор вашего канала
// const channelId = process.env.TELEGRAM_CHANNEL_ID;

// if (!channelId) {
//   throw new Error('Telegram Channel ID not provided!');
// }

// // Создаем экземпляр бота
// const bot = new TelegramBot(token, { polling: true });

// // 1. Функция для чтения данных из файла
// const readUserData = (chatId) => {
//   try {
//     const data = fs.readFileSync(`users/${chatId}.json`, 'utf8');
//     return JSON.parse(data);
//   } catch (error) {
//     return null;
//   }
// };

// // 2. Функция для записи данных в файл
// const writeUserData = (chatId, data) => {
//   fs.writeFileSync(`users/${chatId}.json`, JSON.stringify(data, null, 2));
// };

// // 3. Функция для обновления состояния пользователя
// const updateUserState = (chatId, state, data = {}) => {
//   let userData = readUserData(chatId);
//   if (!userData) {
//     userData = { chatId, language: null, state: null, postData: {} };
//   }
//   userData.state = state;

//   // Очистка строки battleDates от символов, начиная с '#'
//   if (state === 'awaitingBattleMonth' && userData.postData.battleDates) {
//     userData.postData.battleDates = userData.postData.battleDates.split('#')[0];
//   }

//   userData.postData = { ...userData.postData, ...data };
//   writeUserData(chatId, userData);
// };

// // 4. Функция для очистки данных поста
// const clearPostData = (chatId) => {
//   let userData = readUserData(chatId);
//   if (userData) {
//     userData.postData = {};
//     writeUserData(chatId, userData);
//   }
// };

// // Профиль в ГеоНэймс
// const GEONAMES_USERNAME = 'liquidaction'; // Замените на ваш username

// async function checkCityExists(cityName) {
//   try {
//     const response = await axios.get(`http://api.geonames.org/searchJSON?q=${encodeURIComponent(cityName)}&maxRows=1&username=${GEONAMES_USERNAME}`);
//     if (response.data.totalResultsCount > 0) {
//       return {
//         exists: true,
//         country: response.data.geonames[0].countryName
//       };
//     } else {
//       return {
//         exists: false,
//         country: null
//       };
//     }
//   } catch (error) {
//     console.error('Error checking city:', error);
//     return {
//       exists: false,
//       country: null
//     };
//   }
// }

// // 5. Сообщения для разных языков
// const messages = {
//   English: {
//     skipButton: "Skip",
//     changeDateButton: "Change Date",
//     changeMonthButton: "Change Month",
//     addBattleButton: "Add Battle",
//     addPracticeButton: "Add Practice",
//     moreInfoButton: "Check it out",
//     publishButton: "Publish",
//     start: 'Please set your language using /setlanguage <language>.',
//     languageUpdated: 'Language updated to',
//     languageNotSet: 'Please use /start first to initialize your data.',
//     languageSelection: 'Language / Language\n\n/russian — Click to select\n•••\n/english — Click to select',
//     newPost: "Let's start forming the post\n— Choose what you want to add?\n\n/addBattle — Upcoming battle or\n•••\n/addPractice — place where you can practice",
//     addBattle: "Let's add information about the upcoming battle\n— What is it called?",
//     addBattleDates: "Let's add the dates\n— Choose when it starts?",
//     addBattleMonth: "Let's add the month\n— Choose the month?",
//     addBattleYear: "Let's add the year\n— Choose the year?",
//     addBattleLocation: "Determine the location\n— In which city will the Battle take place?",
//     cityNotFound: "I couldn't find this city in the database. Please check for any mistakes and try again.",
//     addBattleDescription: "Add a description or additional information about the event, for example: judges, DJs, nominations, prize fund and other information\n\nYou can also skip this step by clicking the 'Skip' button",
//     addBattleLink: "Add a link to the Battle page (VK, Inst, FB):",
//     invalidLink: "Without a link, we can't continue.",
//     addBattleCover: "Please upload the cover image for the event:",
//     postReady: "Great, the post is ready to be published\n— Choose what you want to do?",
//     postPublished: 'Post published to channel!',
//     invalidCover: "Please upload a valid image file.",
//     notLeapYear: "The selected year is not a leap year, so February 29 does not exist. Please choose another date or year.",
//     invalidDateInMonth: "The selected date ${selectedDate} does not exist in the month ${selectedMonth}. Please choose a correct month or change the date.",
//     dateAlreadyPassed: "The selected date has already passed. Please choose another date or year.",
//     months: [
//       "January", "February", "March", "April", "May", "June",
//       "July", "August", "September", "October", "November", "December"
//     ],
//     searchByTag: "Search by tag:",
    
//   },
//   Russian: {
//     skipButton: "Пропустить",
//     changeDateButton: "Изменить дату",
//     changeMonthButton: "Изменить месяц",
//     addBattleButton: "Добавить Баттл",
//     addPracticeButton: "Тренировку",
//     moreInfoButton: "Подробнее",
//     publishButton: "Опубликовать",
//     start: 'Пожалуйста, установите язык с помощью /setlanguage <язык>.',
//     languageUpdated: 'Язык обновлен на',
//     languageNotSet: 'Пожалуйста, используйте /start сначала для инициализации ваших данных.',
//     languageSelection: 'Язык / Language\n\n/russian — Кликай, что бы выбрать\n•••\n/english — Click to select',
//     newPost: "Начнем формировать пост\n— Выбери Что ты хочешь добавить?\n\n/addBattle — Предстоящий батл или\n•••\n/addPractice — место где можно по тренироваться",
//     addBattle: "Добавим информацию о предстоящем батле\n— Как он называется?",
//     addBattleDates: "Добавим даты\n— Выбери когда он начинается?",
//     addBattleMonth: "Добавим месяц\n— Выбери месяц?",
//     addBattleYear: "Добавим год\n— Выбери год?",
//     addBattleLocation: "Определим локацию\n— В каком городе будет проходить Батл?",
//     cityNotFound: "Я не смог найти этот город в базе данных. Пожалуйста, проверьте на наличие ошибок и попробуйте снова.",
//     addBattleDescription: "Добавьте описание или дополнительную информацию о мероприятии, например: судьи, диджеи, номинации, призовой фонд и прочая информация\n\nВы так же можете пропустить этот шаг нажав на кнопку 'Пропустить'",
//     addBattleLink: "Добавьте ссылку на страницу Батла (VK, Inst, FB):",
//     invalidLink: "Без ссылки не получится продолжить.",
//     addBattleCover: "Пожалуйста, загрузите обложку мероприятия:",
//     postReady: "Отлично, пост готов к публикации\n— Выбери, что ты хочешь сделать?",
//     postPublished: 'Пост опубликован на канале!',
//     invalidCover: "Пожалуйста, загрузите корректный файл изображения.",
//     notLeapYear: "Выбранный год не является високосным, поэтому 29 февраля не существует. Пожалуйста, выберите другую дату или год.",
//     invalidDateInMonth: "Выбранная дата ${selectedDate} не существует в месяце ${selectedMonth}. Пожалуйста, выберите корректный месяц или измените дату.",
//     dateAlreadyPassed: "Выбранная дата уже прошла. Пожалуйста, выберите другую дату или год.",
//     months: [
//       "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
//       "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
//     ],
//     searchByTag: "Поиск по тегу:",
//   }
// };

// // 6. Метки для разных языков
// const labels = {
//   English: {
//     title: "Battle",
//     dates: "Date",
//     city: "Location",
//     description: "Description",
//     link: "Link"
//   },
//   Russian: {
//     title: "Баттл",
//     dates: "Дата",
//     city: "Город",
//     description: "Описание",
//     link: "Ссылка"
//   }
// };

// // 7. Функция для получения меток на основе языка
// function getLabels(language) {
//   return labels[language] || labels['English'];
// }

// // 8. Обработчик команды /start
// bot.onText(/\/start/, (msg) => {
//   const chatId = msg.chat.id;
//   let userData = readUserData(chatId);

//   if (!userData) {
//     userData = {
//       chatId: chatId,
//       language: null // Устанавливаем язык в null, чтобы указать, что язык еще не выбран
//     };
//     writeUserData(chatId, userData);
//     bot.sendMessage(chatId, messages['Russian'].languageSelection);
//   } else if (userData.language === null) {
//     bot.sendMessage(chatId, messages['Russian'].languageSelection);
//   } else {
//     bot.sendMessage(chatId, messages[userData.language].newPost, {
//       reply_markup: createAddButtonsKeyboard(userData.language)
//     });
//   }
// });

// // 9. Обработчик команды /setlanguage
// bot.onText(/\/setlanguage (.+)/, (msg, match) => {
//   const chatId = msg.chat.id;
//   const newLanguage = match[1];
//   let userData = readUserData(chatId);

//   if (userData) {
//     userData.language = newLanguage;
//     writeUserData(chatId, userData);
//     bot.sendMessage(chatId, `${messages[newLanguage].languageUpdated} ${newLanguage}`);
//     bot.sendMessage(chatId, messages[newLanguage].newPost, {
//       reply_markup: createAddButtonsKeyboard(newLanguage)
//     });
//   } else {
//     bot.sendMessage(chatId, messages['Russian'].languageNotSet);
//   }
// });

// // 10. Обработчик команды /russian
// bot.onText(/\/russian/, (msg) => {
//   const chatId = msg.chat.id;
//   let userData = readUserData(chatId);

//   if (userData) {
//     userData.language = 'Russian';
//     writeUserData(chatId, userData);
//     bot.sendMessage(chatId, `${messages['Russian'].languageUpdated} Русский`);
//     bot.sendMessage(chatId, messages['Russian'].newPost, {
//       reply_markup: createAddButtonsKeyboard('Russian')
//     });
//   } else {
//     bot.sendMessage(chatId, messages['Russian'].languageNotSet);
//   }
// });

// // 11. Обработчик команды /english
// bot.onText(/\/english/, (msg) => {
//   const chatId = msg.chat.id;
//   let userData = readUserData(chatId);

//   if (userData) {
//     userData.language = 'English';
//     writeUserData(chatId, userData);
//     bot.sendMessage(chatId, `${messages['English'].languageUpdated} English`);
//     bot.sendMessage(chatId, messages['English'].newPost, {
//       reply_markup: createAddButtonsKeyboard('English')
//     });
//   } else {
//     bot.sendMessage(chatId, messages['Russian'].languageNotSet);
//   }
// });

// // 12. Обработчик команды /newPost
// bot.onText(/\/newPost/, (msg) => {
//   const chatId = msg.chat.id;
//   let userData = readUserData(chatId);

//   if (userData && userData.language) {
//     bot.sendMessage(chatId, messages[userData.language].newPost, {
//       reply_markup: createAddButtonsKeyboard(userData.language)
//     });
//   } else {
//     bot.sendMessage(chatId, messages['Russian'].languageNotSet);
//   }
// });

// // 13. Обработчик команды /addBattle
// bot.onText(/\/addBattle/, (msg) => {
//   const chatId = msg.chat.id;
//   let userData = readUserData(chatId);

//   if (userData && userData.language) {
//     clearPostData(chatId); // Очищаем данные перед началом нового процесса
//     updateUserState(chatId, 'awaitingBattleName'); // Обновляем состояние на awaitingBattleName
//     bot.sendMessage(chatId, messages[userData.language].addBattle);
//   } else {
//     bot.sendMessage(chatId, messages['Russian'].languageNotSet);
//   }
// });

// bot.onText(/\/addPractice/, (msg) => {
//   const chatId = msg.chat.id;
//   let userData = readUserData(chatId);

//   if (userData && userData.language) {
//     clearPostData(chatId); // Очищаем данные перед началом нового процесса
//     updateUserState(chatId, 'awaitingPracticeName'); // Предполагается, что у вас есть состояние awaitingPracticeName
//     bot.sendMessage(chatId, messages[userData.language].addPractice); // Предполагается, что у вас есть сообщение addPractice
//   } else {
//     bot.sendMessage(chatId, messages['Russian'].languageNotSet);
//   }
// });

// // 14. Обработчик сообщений
// bot.on('message', async (msg) => {
//   const chatId = msg.chat.id;
//   const text = msg.text;
//   let userData = readUserData(chatId);

//   if (userData && userData.language) {
//     if (text === messages[userData.language].addBattleButton) {
//       bot.processUpdate({
//         update_id: Math.floor(Math.random() * 1000000), // Генерируем случайный update_id
//         message: {
//           chat: { id: chatId },
//           text: '/addBattle'
//         }
//       });
//       return;
//     } else if (text === messages[userData.language].addPracticeButton) {
//       bot.processUpdate({
//         update_id: Math.floor(Math.random() * 1000000), // Генерируем случайный update_id
//         message: {
//           chat: { id: chatId },
//           text: '/addPractice'
//         }
//       });
//       return;
//     }
//   }

//   if (!userData || !userData.state) return;

//   const stateHandlers = {
//     awaitingBattleName: handleAwaitingBattleName,
//     awaitingBattleDates: handleAwaitingBattleDates,
//     awaitingBattleYear: handleAwaitingBattleYear,
//     awaitingBattleLocation: handleAwaitingBattleLocation,
//     awaitingBattleDescription: handleAwaitingBattleDescription,
//     awaitingBattleLink: handleAwaitingBattleLink
//   };

//   const handler = stateHandlers[userData.state];
//   if (handler) {
//     handler(msg, chatId, userData);
//   }
// });

// // Функция для обработки состояния 'awaitingBattleName'
// function handleAwaitingBattleName(msg, chatId, userData) {
//   if (msg.text.startsWith('/')) return;
//   updateUserState(chatId, 'awaitingBattleDates', { battleName: msg.text });
//   bot.sendMessage(chatId, messages[userData.language].addBattleDates, { reply_markup: createDateKeyboard() });
// }

// // Функция для обработки состояния 'awaitingBattleDates'
// function handleAwaitingBattleDates(msg, chatId, userData) {
//   if (msg.text.startsWith('/')) return;
//   updateUserState(chatId, 'awaitingBattleMonth', { battleDates: msg.text });
//   bot.sendMessage(chatId, messages[userData.language].addBattleMonth, { reply_markup: createMonthKeyboard(userData.language) });
// }

// // Функция для обработки состояния 'awaitingBattleYear'
// function handleAwaitingBattleYear(msg, chatId, userData) {
//   if (msg.text.startsWith('/')) return;
//   updateUserState(chatId, 'awaitingBattleLocation', { battleYear: msg.text });
//   bot.sendMessage(chatId, messages[userData.language].addBattleLocation);
// }

// // Функция для обработки состояния 'awaitingBattleLocation'
// async function handleAwaitingBattleLocation(msg, chatId, userData) {
//   if (msg.text.startsWith('/')) return;
//   const cityName = msg.text;
//   const cityCheck = await checkCityExists(cityName);
//   if (!cityCheck.exists) {
//     bot.sendMessage(chatId, `${messages[userData.language].cityNotFound}\n\n${messages[userData.language].addBattleLocation}`);
//     return;
//   }
//   updateUserState(chatId, 'awaitingBattleDescription', { battleLocation: `${cityName}, ${cityCheck.country}` });
//   bot.sendMessage(chatId, messages[userData.language].addBattleDescription, { reply_markup: createSkipKeyboard(userData.language) });
// }

// // Функция для обработки состояния 'awaitingBattleDescription'
// function handleAwaitingBattleDescription(msg, chatId, userData) {
//   if (msg.text.startsWith('/')) return;
//   updateUserState(chatId, 'awaitingBattleLink', { battleDescription: msg.text });
//   bot.sendMessage(chatId, messages[userData.language].addBattleLink);
// }

// // Функция для обработки состояния 'awaitingBattleLink'
// function handleAwaitingBattleLink(msg, chatId, userData) {
//   if (msg.text.startsWith('/')) return;
//   if (!isValidUrl(msg.text)) {
//     bot.sendMessage(chatId, `${messages[userData.language].addBattleLink}\n\n${messages[userData.language].invalidLink}`);
//     return;
//   }
//   updateUserState(chatId, 'completed', { battleLink: msg.text });

//   // Прочитать данные пользователя снова после обновления состояния
//   const updatedUserData = readUserData(chatId);

//   sendFinalMessage(chatId, updatedUserData);
// }

// let postReadyMessageId = null; // Глобальная переменная для хранения идентификатора сообщения о готовности поста к публикации

// function sendFinalMessage(chatId, userData) {
//   const userLabels = getLabels(userData.language);
//   const description = userData.postData.battleDescription ? `${userLabels.description}: ${userData.postData.battleDescription}\n\n` : '';

//   // Разделение battleDates на дату и месяц с годом
//   const [datePart, monthYearPart] = userData.postData.battleDates.split('#');

//   // Формирование полной даты
//   const fullDate = `${datePart} ${userData.postData.battleMonth} ${userData.postData.battleYear}`;

//   // Формирование тегов
//   const cityTag = userData.postData.battleLocation.split(',')[0].replace(/\s+/g, '');
//   const monthTag = userData.postData.battleMonth.replace(/\s+/g, '');
//   const yearTag = userData.postData.battleYear;
//   const tags = `#${cityTag}${monthTag}${yearTag} | #${monthTag}${yearTag}`;

//   // Преобразование названия батла в верхний регистр
//   const battleNameUpperCase = userData.postData.battleName.toUpperCase();

//   // Создание кликабельной ссылки для названия батла
//   const battleNameLink = `<a href="${userData.postData.battleLink}">${battleNameUpperCase}</a>`;

//   // Проверка на undefined
//   const battleLink = userData.postData.battleLink;
//   if (!battleLink) {
//     console.error('battleLink is undefined');
//     bot.sendMessage(chatId, 'Error: battleLink is undefined');
//     return;
//   }

//   // Создание кнопки "подробнее"/"Check it out" с использованием сообщений из "const messages"
//   const inlineKeyboard = [
//     [{ text: messages[userData.language].moreInfoButton, url: battleLink }]
//   ];

//   bot.sendMessage(chatId, `${userLabels.title}: ${battleNameLink}\n\n—\n${userLabels.dates}: ${fullDate}\n${userLabels.city}: ${userData.postData.battleLocation}\n•••\n\n${description}\n\n${messages[userData.language].searchByTag} ${tags}`, {
//     reply_markup: {
//       inline_keyboard: inlineKeyboard
//     },
//     parse_mode: 'HTML'
//   }).then(() => {
//     // Отправка сообщения о готовности поста к публикации после отправки итогового сообщения
//     sendPostReadyMessage(chatId, userData.language);
//   }).catch(error => {
//     console.error('Error sending final message:', error);
//     bot.sendMessage(chatId, 'Failed to send final message. Please check logs for details.');
//   });
// }

// // Функция для отправки сообщения о готовности поста к публикации
// function sendPostReadyMessage(chatId, language) {
//   const keyboard = {
//     inline_keyboard: [
//       [{ text: messages[language].publishButton, callback_data: 'publish' }]
//     ]
//   };
//   bot.sendMessage(chatId, messages[language].postReady, { reply_markup: keyboard }).then(sentMessage => {
//     postReadyMessageId = sentMessage.message_id; // Сохраняем идентификатор сообщения о готовности поста к публикации
//   }).catch(error => {
//     console.error('Error sending post ready message:', error);
//   });
// }

// bot.onText(/\/sendfinalmessage/, (msg) => {
//   const chatId = msg.chat.id;
//   const userData = readUserData(chatId); // Предполагается, что у вас есть функция для чтения данных пользователя

//   if (userData) {
//     sendFinalMessage(chatId, userData);
//   } else {
//     bot.sendMessage(chatId, 'User data not found.');
//   }
// });

// //15 Функция для проверки валидности URL
// function isValidUrl(string) {
//   try {
//     new URL(string);
//     return true;
//   } catch (_) {
//     return false;
//   }
// }

// // Функция для создания клавиатуры с кнопками "Добавить баттл" и "Добавить тренировку"
// const createAddButtonsKeyboard = (language) => {
//   return {
//     keyboard: [
//       [{ text: messages[language].addBattleButton }, { text: messages[language].addPracticeButton }]
//     ],
//     resize_keyboard: true,
//     one_time_keyboard: true
//   };
// };
// // 16. Функция для создания клавиатуры с датами
// const createDateKeyboard = () => {
//   const keyboard = [];
//   for (let i = 1; i <= 31; i += 7) {
//     const row = [];
//     for (let j = i; j < i + 7 && j <= 31; j++) {
//       row.push({ text: j.toString(), callback_data: j.toString() });
//     }
//     keyboard.push(row);
//   }
//   return { inline_keyboard: keyboard };
// };

// // 17. Функция для создания клавиатуры с месяцами
// const createMonthKeyboard = (language, selectedDate) => {
//   const selectedMonths = messages[language].months;
//   const keyboard = [];
//   for (let i = 0; i < selectedMonths.length; i += 3) {
//     const row = [];
//     for (let j = i; j < i + 3 && j < selectedMonths.length; j++) {
//       row.push({ text: selectedMonths[j], callback_data: selectedMonths[j] });
//     }
//     keyboard.push(row);
//   }
//   // Добавляем кнопку "Изменить дату"
//   keyboard.push([{ text: messages[language].changeDateButton, callback_data: 'change_date' }]);
//   return { inline_keyboard: keyboard };
// };


// // 18. Функция для создания клавиатуры с годами и кнопкой "Изменить месяц"
// const createYearKeyboard = (language) => {
//   const currentYear = new Date().getFullYear();
//   const nextYear = currentYear + 1;
//   const keyboard = [
//     [{ text: currentYear.toString(), callback_data: currentYear.toString() }],
//     [{ text: nextYear.toString(), callback_data: nextYear.toString() }],
//     [{ text: messages[language].changeMonthButton, callback_data: 'change_month' }] // Используем сообщение в зависимости от языка
//   ];
//   return { inline_keyboard: keyboard };
// };


// // 19. Функция для создания клавиатуры с кнопкой "Пропустить"
// const createSkipKeyboard = (language) => {
//   return {
//     inline_keyboard: [
//       [{ text: messages[language].skipButton, callback_data: 'skip_description' }]
//     ]
//   };
// };




// //20 Функция для получения количества дней в месяце
// const getDaysInMonth = (month, language) => {
//   const monthIndex = messages[language].months.indexOf(month);
//   const daysInMonth = new Date(new Date().getFullYear(), monthIndex + 1, 0).getDate();
//   return daysInMonth;
// };

// //21 Функция для получения индекса месяца
// const getMonthIndex = (month, language) => {
//   return messages[language].months.indexOf(month);
// };


// //22 Функция для проверки, является ли год високосным
// const isLeapYear = (year, language) => {
//   const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
//   if (!isLeap) {
//     return messages[language].notLeapYear;
//   }
//   return null;
// };

// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// // Функция для обработки состояния 'awaitingBattleDates'
// function handleAwaitingBattleDatesCallback(query, chatId, messageId, selectedValue, userData) {
//   updateUserState(chatId, 'awaitingBattleMonth', { battleDates: selectedValue });
//   bot.editMessageText(messages[userData.language].addBattleMonth, { chat_id: chatId, message_id: messageId, reply_markup: createMonthKeyboard(userData.language, selectedValue) });
// }

// // Функция для обработки состояния 'awaitingBattleMonth'
// function handleAwaitingBattleMonthCallback(query, chatId, messageId, selectedValue, userData) {
//   if (selectedValue === 'change_date') {
//     updateUserState(chatId, 'awaitingBattleDates');
//     bot.editMessageText(messages[userData.language].addBattleDates, { chat_id: chatId, message_id: messageId, reply_markup: createDateKeyboard() });
//     return;
//   }
//   const selectedDateForMonth = userData.postData.battleDates;
//   const selectedMonthForDates = selectedValue;
//   const daysInMonth = getDaysInMonth(selectedMonthForDates, userData.language);
//   if (selectedDateForMonth > daysInMonth) {
//     bot.answerCallbackQuery(query.id, { text: messages[userData.language].invalidDateInMonth.replace('${selectedDate}', selectedDateForMonth).replace('${selectedMonth}', selectedMonthForDates), show_alert: true });
//     return;
//   }
//   const combinedDate = `${userData.postData.battleDates} #${selectedValue}`;
//   updateUserState(chatId, 'awaitingBattleYear', { battleMonth: selectedValue, battleDates: combinedDate });
//   bot.editMessageText(messages[userData.language].addBattleYear, { chat_id: chatId, message_id: messageId, reply_markup: createYearKeyboard(userData.language) }); // Передаем язык пользователя
// }

// // Функция для обработки состояния 'awaitingBattleYear'
// function handleAwaitingBattleYearCallback(query, chatId, messageId, selectedValue, userData) {
//   if (selectedValue === 'change_month') {
//     updateUserState(chatId, 'awaitingBattleMonth');
//     bot.editMessageText(messages[userData.language].addBattleMonth, { chat_id: chatId, message_id: messageId, reply_markup: createMonthKeyboard(userData.language, userData.postData.battleDates) });
//     return;
//   }
//   const selectedYear = parseInt(selectedValue);
//   const selectedMonthForYear = userData.postData.battleMonth;
//   const selectedDateForYear = parseInt(userData.postData.battleDates);

//   if (selectedMonthForYear === 'Февраль' && selectedDateForYear === 29) {
//     const leapYearMessage = isLeapYear(selectedYear, userData.language);
//     if (leapYearMessage) {
//       bot.answerCallbackQuery(query.id, { text: leapYearMessage, show_alert: true });
//       return;
//     }
//   }

//   const eventDate = new Date(selectedYear, getMonthIndex(selectedMonthForYear, userData.language), selectedDateForYear);
//   const currentDate = new Date();
//   if (eventDate < currentDate) {
//     bot.answerCallbackQuery(query.id, { text: messages[userData.language].dateAlreadyPassed, show_alert: true });
//     return;
//   }
//   const combinedDateYear = `${userData.postData.battleDates}${selectedValue}`;
//   updateUserState(chatId, 'awaitingBattleLocation', { battleYear: selectedValue, battleDates: combinedDateYear });
//   bot.editMessageText(messages[userData.language].addBattleLocation, { chat_id: chatId, message_id: messageId });
// }

// // Функция для обработки состояния 'awaitingBattleDescription'
// function handleAwaitingBattleDescriptionCallback(query, chatId, messageId, selectedValue, userData) {
//   if (selectedValue === 'skip_description') {
//     updateUserState(chatId, 'awaitingBattleLink');
//     bot.sendMessage(chatId, messages[userData.language].addBattleLink);
//   }
// }

// // Функция для обработки состояния 'completed'
// function handleCompletedCallback(query, chatId, messageId, selectedValue, userData) {
//   if (selectedValue === 'publish') {
//     publishToChannel(chatId, userData);
//     bot.sendMessage(chatId, messages[userData.language].postPublished); // Отправляем сообщение в чат с учетом выбранного языка
//   }
// }


// // Функция для публикации сообщения в канал
// async function publishToChannel(chatId, userData) {
//   const userLabels = getLabels(userData.language);
//   const description = userData.postData.battleDescription ? `${userLabels.description}: ${userData.postData.battleDescription}\n\n` : '';

//   // Разделение battleDates на дату и месяц с годом
//   const [datePart, monthYearPart] = userData.postData.battleDates.split('#');

//   // Формирование полной даты
//   const fullDate = `${datePart} ${userData.postData.battleMonth} ${userData.postData.battleYear}`;

//   // Формирование тегов
//   const cityTag = userData.postData.battleLocation.split(',')[0].replace(/\s+/g, '');
//   const monthTag = userData.postData.battleMonth.replace(/\s+/g, '');
//   const yearTag = userData.postData.battleYear;
//   const tags = `#${cityTag}${monthTag}${yearTag} | #${monthTag}${yearTag}`;

//   // Преобразование названия батла в верхний регистр
//   const battleNameUpperCase = userData.postData.battleName.toUpperCase();

//   // Создание кликабельной ссылки для названия батла
//   const battleNameLink = `<a href="${userData.postData.battleLink}">${battleNameUpperCase}</a>`;

//   // Проверка на undefined
//   const battleLink = userData.postData.battleLink;
//   if (!battleLink) {
//     console.error('battleLink is undefined');
//     bot.sendMessage(chatId, 'Error: battleLink is undefined');
//     return;
//   }

//   // Создание кнопки "подробнее"/"Check it out" с использованием сообщений из "const messages"
//   const inlineKeyboard = [
//     [{ text: messages[userData.language].moreInfoButton, url: battleLink }]
//   ];

//   try {
//     await bot.sendMessage(channelId, `${userLabels.title}: ${battleNameLink}\n\n—\n${userLabels.dates}: ${fullDate}\n${userLabels.city}: ${userData.postData.battleLocation}\n•••\n\n${description}\n\n${messages[userData.language].searchByTag} ${tags}`, {
//       reply_markup: {
//         inline_keyboard: inlineKeyboard
//       },
//       parse_mode: 'HTML'
//     });
//     console.log('Post successfully published to channel.'); // Добавьте это для логирования

//     // Удаление сообщения о готовности поста к публикации
//     if (postReadyMessageId) {
//       bot.deleteMessage(chatId, postReadyMessageId).catch(error => {
//         console.error('Error deleting post ready message:', error);
//       });
//     }
//   } catch (error) {
//     console.error('Error publishing to channel:', error);
//     bot.sendMessage(chatId, 'Failed to publish post to channel. Please check logs for details.');
//   }
// }

// // Основной обработчик callback-запросов
// bot.on('callback_query', (query) => {
//   const chatId = query.message.chat.id;
//   const messageId = query.message.message_id;
//   const selectedValue = query.data;
//   let userData = readUserData(chatId);

//   if (!userData || !userData.state) {
//     return;
//   }

//   const callbackHandlers = {
//     awaitingBattleDates: handleAwaitingBattleDatesCallback,
//     awaitingBattleMonth: handleAwaitingBattleMonthCallback,
//     awaitingBattleYear: handleAwaitingBattleYearCallback,
//     awaitingBattleDescription: handleAwaitingBattleDescriptionCallback,
//     completed: handleCompletedCallback
//   };

//   const handler = callbackHandlers[userData.state];
//   if (handler) {
//     handler(query, chatId, messageId, selectedValue, userData);
//   }
//   bot.answerCallbackQuery(query.id);
// });


