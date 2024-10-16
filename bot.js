const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config(); // Загружаем переменные окружения из файла .env
const cron = require("node-cron");
const { saveEventsData, sendEventPost } = require("./eventScraper"); // Импортируем функции из eventScraper.js

// Получаем токен бота из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("Telegram Bot Token not provided!");
}

// Добавьте идентификатор вашего канала
const channelId = process.env.TELEGRAM_CHANNEL_ID;

if (!channelId) {
  throw new Error("Telegram Channel ID not provided!");
}

// Создаем экземпляр бота
const bot = new TelegramBot(token, { polling: true });

// 1. Функция для чтения данных из файла
const readUserData = (chatId) => {
  const filePath = `users/${chatId}.json`;
  console.log(`Reading user data from file: ${filePath}`); // Логирование пути к файлу
  if (!fs.existsSync(filePath)) {
    console.log(`File ${filePath} does not exist.`); // Логирование, если файл не существует
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading user data for chatId ${chatId}:`, error);
    return null;
  }
};

// Функция для записи данных пользователя
const writeUserData = (chatId, data) => {
  const filePath = `users/${chatId}.json`;
  console.log(`Writing user data to file: ${filePath}`); // Логирование пути к файлу
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing user data for chatId ${chatId}:`, error);
  }
};

// 3. Функция для обновления состояния пользователя
// 3. Функция для обновления состояния пользователя
const updateUserState = (chatId, state, data = {}) => {
  let userData = readUserData(chatId);
  if (!userData) {
    userData = {
      chatId,
      language: null,
      state: null,
      postData: {},
      approved: false,
    }; // Добавлено approved: false
  }
  userData.state = state;

  // Очистка строки battleDates от символов, начиная с '#'
  if (state === "awaitingBattleMonth" && userData.postData.battleDates) {
    userData.postData.battleDates = userData.postData.battleDates.split("#")[0];
  }

  userData.postData = { ...userData.postData, ...data };
  writeUserData(chatId, userData);
};

// 4. Функция для очистки данных поста
const clearPostData = (chatId) => {
  let userData = readUserData(chatId);
  if (userData) {
    userData.postData = {};
    writeUserData(chatId, userData);
  }
};

// 5.   Профиль в ГеоНэймс
const GEONAMES_USERNAME = "liquidaction"; // Замените на ваш username

async function checkCityExists(cityName) {
  try {
    const response = await axios.get(
      `http://api.geonames.org/searchJSON?q=${encodeURIComponent(
        cityName
      )}&maxRows=1&username=${GEONAMES_USERNAME}`
    );
    if (response.data.totalResultsCount > 0) {
      return {
        exists: true,
        country: response.data.geonames[0].countryName,
      };
    } else {
      return {
        exists: false,
        country: null,
      };
    }
  } catch (error) {
    console.error("Error checking city:", error);
    return {
      exists: false,
      country: null,
    };
  }
}

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Убедитесь, что у вас есть этот ID в .env

// 6. Функция для запроса одобрения администратора
async function requestAdminApproval(chatId, userData) {
  try {
    const chatInfo = await bot.getChat(chatId);
    const username = chatInfo.username ? `(@${chatInfo.username})` : "";

    const inlineKeyboard = [
      [
        {
          text: messages[userData.language].approveButton,
          callback_data: `approve_${chatId}`,
        },
      ],
      [
        {
          text: messages[userData.language].rejectButton,
          callback_data: `reject_${chatId}`,
        },
      ],
    ];

    bot.sendMessage(
      ADMIN_CHAT_ID,
      `${
        messages[userData.language].userWantsToPublish
      } ${chatId} ${username}. ${
        messages[userData.language].pleaseApproveOrReject
      }`,
      {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }
    );
  } catch (error) {
    console.error("Error requesting admin approval:", error);
  }
}

const {
  saveEventData,
  months,
  getEventsForThisWeek,
  deletePastEvents, // Убедитесь, что эта строка присутствует
  scheduleEventsForThisWeek,
} = require("./dataSaver");

scheduleEventsForThisWeek(bot, channelId);

// Обработчики команд
bot.onText(/\/testnewfeature/, (msg) => {
  console.log("Received /testnewfeature command");
  newFeatureFunction(bot, msg);
});

// 2. Обработчик команды /extractvk
bot.onText(/\/getevents/, async (msg) => {
  const chatId = msg.chat.id;
  console.log("Received /getevents command");

  try {
    // Удаляем прошедшие события перед отправкой
    console.log("Deleting past events...");
    deletePastEvents();
    console.log("Past events deleted successfully.");

    const eventsForThisWeek = getEventsForThisWeek();

    if (
      eventsForThisWeek === "No events found." ||
      eventsForThisWeek === "Error reading event data."
    ) {
      console.log(eventsForThisWeek); // Выводим сообщение в консоль
      return; // Завершаем выполнение функции
    } else {
      const { ruEvents, enEvents } = eventsForThisWeek;

      // Проверка наличия событий
      if (ruEvents.length === 0 && enEvents.length === 0) {
        console.log("No events this week."); // Выводим сообщение в консоль
        return; // Завершаем выполнение функции
      }

      const ruMessage =
        ruEvents.length > 0
          ? `События на этой неделе:\n\n${ruEvents.join("\n")}`
          : null;

      const enMessage =
        enEvents.length > 0
          ? `Events for this week:\n\n${enEvents.join("\n")}`
          : null;

      // Отправка сообщений на канал, только если они не пустые
      if (ruMessage) {
        await bot.sendMessage(channelId, ruMessage, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      }

      if (enMessage) {
        await bot.sendMessage(channelId, enMessage, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      }
    }
  } catch (error) {
    console.error("Error sending events for this week:", error);
  }
});

//Извлечение инфы из ссылки ВК
const { extractEventInfo } = require("./vkEventExtractor");

// Обработчик команды /extractvk
bot.onText(/\/extractvk/, async (msg) => {
  const chatId = msg.chat.id;

  // Прочитать данные пользователя
  let userData = readUserData(chatId);

  if (!userData || !userData.language) {
    bot.sendMessage(
      chatId,
      "Язык не выбран. Пожалуйста, выберите язык с помощью команды /setlanguage."
    );
    return;
  }

  // Отправить сообщение с запросом ссылки на событие в зависимости от выбранного языка
  bot.sendMessage(chatId, messages[userData.language].addBattleLink);

  // Обновить состояние пользователя, чтобы бот ждал ссылку на событие
  updateUserState(chatId, "awaitingEventLink");
});

// 7. Обновление сообщений для разных языков
const messages = {
  English: {
    skipButton: "Skip",
    changeDateButton: "Change Date",
    changeMonthButton: "Change Month",
    addBattleButton: "Add Battle",
    addPracticeButton: "Add Practice",
    moreInfoButton: "Check it out",
    publishButton: "Publish",
    start: "Please set your language using /setlanguage <language>.",
    languageUpdated: "Language updated to",
    languageNotSet: "Please use /start first to initialize your data.",
    languageSelection:
      "Language / Language\n\n/russian — Click to select\n•••\n/english — Click to select",
    newPost:
      "Let's start forming the post\n— Choose what you want to add?\n\n/addBattle — Upcoming battle or\n•••\n/addPractice — place where you can practice",
    addBattle:
      "Let's add information about the upcoming battle\n— What is it called?",
    addBattleDates: "Let's add the dates\n— Choose when it starts?",
    addBattleMonth: "Let's add the month\n— Choose the month?",
    addBattleYear: "Let's add the year\n— Choose the year?",
    addBattleLocation:
      "Determine the location\n— In which city will the Battle take place?",
    cityNotFound:
      "I couldn't find this city in the database. Please check for any mistakes and try again.",
    addBattleDescription:
      "Add a description or additional information about the event, for example:\n• judges\n• DJs\n• Nominations\n• Prize fund and other information\n\nYou can also skip this step by clicking the 'Skip' button",
    textOnlyDescription:
      "❗️ Please send a text description. Other types of messages are not allowed.\n\n",
    addBattleLink: "Add a link to the Battle page (VK, Inst, FB):",
    invalidLink: "Without a link, we can't continue.",
    postReady:
      "Great, the post is ready to be published\n—  It remains to publish it",
    postPublished: "Post published to channel!",
    invalidPracticeName:
      "The practice name can only contain letters. Please enter a valid name.",
    invalidBattleName:
      "The battle name can only contain letters. Please enter a valid name.",
    notLeapYear:
      "The selected year is not a leap year, so February 29 does not exist. Please choose another date or year.",
    invalidDateInMonth:
      "The selected date ${selectedDate} does not exist in the month ${selectedMonth}. Please choose a correct month or change the date.",
    dateAlreadyPassed:
      "The selected date has already passed. Please choose another date or year.",
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    searchByTag: "Search by tag:",
    addPractice:
      "Let's add information about the practice place\n— What is it called?",
    addPracticeLocation:
      "Determine the location\n— In which city will the practice take place?",
    addPracticeDescription:
      "Add a description or additional information about the practice place, for example:\n• Adress\n• Schedule\n• Contacts etc.\n\nYou can also skip this step by clicking the 'Skip' button",
    addPracticeLink: "Add a link to the practice place page (VK, Inst, FB):",

    postApproved: "Your post has been approved and published.",
    postRejected:
      "Your post has been rejected\n— Please contact @lqdamc to resolve the issue",
    postAwaitingApproval:
      "The confirmation request has been sent.\n— Further posts will be sent automatically",
    userWantsToPublish: "User",
    pleaseApproveOrReject: "wants to publish a post. Please approve or reject.",
    approveButton: "Approve",
    rejectButton: "Reject",

    postFromUser: "Post from user ID",
    blockButton: "Block",
    unblockButton: "Unblock",

    blockedMessage:
      "You have been blocked for violating publication rules. If you believe this is an error, please contact @lqdamc.",
    unblockRequestSent:
      "Your request for unblocking has been sent to the administrator.",
    notBlocked: "You are not blocked.",
  },
  Russian: {
    skipButton: "Пропустить",
    changeDateButton: "Изменить дату",
    changeMonthButton: "Изменить месяц",
    addBattleButton: "Добавить Баттл",
    addPracticeButton: "Тренировку",
    moreInfoButton: "Подробнее",
    publishButton: "Опубликовать",
    start: "Пожалуйста, установите язык с помощью /setlanguage <язык>.",
    languageUpdated: "Язык обновлен на",
    languageNotSet:
      "Пожалуйста, используйте /start сначала для инициализации ваших данных.",
    languageSelection:
      "Язык / Language\n\n/russian — Кликай, что бы выбрать\n•••\n/english — Click to select",
    newPost:
      "Начнем формировать пост\n— Выбери Что ты хочешь добавить?\n\n/addBattle — Предстоящий батл или\n•••\n/addPractice — место где можно по тренироваться",
    addBattle: "Добавим информацию о предстоящем батле\n— Как он называется?",
    addBattleDates: "Добавим даты\n— Выбери когда он начинается?",
    addBattleMonth: "Добавим месяц\n— Выбери месяц?",
    addBattleYear: "Добавим год\n— Выбери год?",
    addBattleLocation:
      "Определим локацию\n— В каком городе будет проходить Батл?",
    cityNotFound:
      "Я не смог найти этот город в базе данных. Пожалуйста, проверьте на наличие ошибок и попробуйте снова.",
    addBattleDescription:
      "Добавьте описание или дополнительную информацию о мероприятии, например:\n• судьи\n• диджеи\n•  номинации\n• призовой фонд и прочая информация\n\nВы так же можете пропустить этот шаг нажав на кнопку 'Пропустить'",
    textOnlyDescription:
      "❗️ Пожалуйста, отправьте текстовое описание. Другие типы сообщений не допускаются.\n\n",
    addBattleLink: "Добавьте ссылку на страницу Батла (VK, Inst, FB):",
    invalidLink: "Без ссылки не получится продолжить.",
    postReady: "Отлично, пост готов к публикации\n— Осталось его опубликовать",
    postPublished: "Пост опубликован на канале!",
    invalidPracticeName:
      "Название тренировки может содержать только буквы. Пожалуйста, введите корректное название.",
    invalidBattleName:
      "Название батла может содержать только буквы. Пожалуйста, введите корректное название.",
    notLeapYear:
      "Выбранный год не является високосным, поэтому 29 февраля не существует. Пожалуйста, выберите другую дату или год.",
    invalidDateInMonth:
      "Выбранная дата ${selectedDate} не существует в месяце ${selectedMonth}. Пожалуйста, выберите корректный месяц или измените дату.",
    dateAlreadyPassed:
      "Выбранная дата уже прошла. Пожалуйста, выберите другую дату или год.",
    months: [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ],
    searchByTag: "Поиск по тегу:",
    addPractice: "Добавим информацию о месте тренировки\n— Как оно называется?",
    addPracticeLocation:
      "Определим локацию\n— В каком городе будет проходить тренировка?",
    addPracticeDescription:
      "Добавьте описание или дополнительную информацию о месте тренировки, например:\n• Точный адрес\n•  Расписание\n•  Контакты и т.д.\n\nВы так же можете пропустить этот шаг нажав на кнопку 'Пропустить'",
    addPracticeLink:
      "Добавьте ссылку на страницу места тренировки (VK, Inst, FB):",

    postApproved: "Ваш запрос одобрен.",
    postRejected:
      "Ваш пост был отклонен\n— Пожалуйста свяжитесь с @lqdamc, что бы решить проблему",
    postAwaitingApproval:
      "Запрос на подтверждение отправлен.\n— Дальнейшие посты будут отправляться автоматически",
    userWantsToPublish: "Пользователь",
    pleaseApproveOrReject:
      "хочет опубликовать пост. Пожалуйста, одобрите или отклоните.",
    approveButton: "Одобрить",
    rejectButton: "Отклонить",

    postFromUser: "Пост от пользователя ID",
    blockButton: "Заблокировать",
    unblockButton: "Разблокировать",

    blockedMessage:
      "Вы были заблокированы за нарушение правил публикации. Если вы считаете, что произошла ошибка, свяжитесь с @lqdamc.",
    unblockRequestSent: "Ваш запрос на разблокировку отправлен администратору.",
    notBlocked: "Вы разблокированы.",
  },
};

// 8. Функция для получения меток на основе языка
function getLabels(language) {
  return labels[language] || labels["English"];
}

// 9. Метки для разных языков
const labels = {
  English: {
    battle: {
      title: "Battle",
      dates: "Date",
      city: "Location",
      description: "Description",
      link: "Link",
    },
    practice: {
      title: "Practice",
      city: "Location",
      description: "Description",
      link: "Link",
    },
  },
  Russian: {
    battle: {
      title: "Баттл",
      dates: "Дата",
      city: "Город",
      description: "Описание",
      link: "Ссылка",
    },
    practice: {
      title: "Тренировки",
      city: "Город",
      description: "Описание",
      link: "Ссылка",
    },
  },
};

// 10. Функция для получения меток на основе языка
function getLabels(language) {
  return labels[language] || labels["English"];
}

////////////////////////////////////// COMANDS //////////////////////////////////////

// 11. Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  let userData = readUserData(chatId);

  if (!userData) {
    userData = {
      chatId: chatId,
      language: null, // Устанавливаем язык в null, чтобы указать, что язык еще не выбран
      blocked: false, // Добавляем поле blocked
    };
    writeUserData(chatId, userData);
    bot.sendMessage(chatId, messages["Russian"].languageSelection);
  } else if (userData.language === null) {
    bot.sendMessage(chatId, messages["Russian"].languageSelection);
  } else if (userData.state === "awaitingAdminApproval") {
    bot.sendMessage(chatId, messages[userData.language].postAwaitingApproval);
  } else {
    bot.sendMessage(chatId, messages[userData.language].newPost, {
      reply_markup: createAddButtonsKeyboard(userData.language),
    });
  }
});

// 12. Обработчик команды /setlanguage
bot.onText(/\/setlanguage (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const newLanguage = match[1];
  let userData = readUserData(chatId);

  if (userData) {
    userData.language = newLanguage;
    writeUserData(chatId, userData);
    bot.sendMessage(
      chatId,
      `${messages[newLanguage].languageUpdated} ${newLanguage}`
    );
    bot.sendMessage(chatId, messages[newLanguage].newPost, {
      reply_markup: createAddButtonsKeyboard(newLanguage),
    });
  } else {
    bot.sendMessage(chatId, messages["Russian"].languageNotSet);
  }
});

// 13. Обработчик команды /russian
bot.onText(/\/russian/, (msg) => {
  const chatId = msg.chat.id;
  let userData = readUserData(chatId);

  if (userData) {
    userData.language = "Russian";
    writeUserData(chatId, userData);
    bot.sendMessage(chatId, `${messages["Russian"].languageUpdated} Русский`);
    bot.sendMessage(chatId, messages["Russian"].newPost, {
      reply_markup: createAddButtonsKeyboard("Russian"),
    });
  } else {
    bot.sendMessage(chatId, messages["Russian"].languageNotSet);
  }
});

// 14. Обработчик команды /english
bot.onText(/\/english/, (msg) => {
  const chatId = msg.chat.id;
  let userData = readUserData(chatId);

  if (userData) {
    userData.language = "English";
    writeUserData(chatId, userData);
    bot.sendMessage(chatId, `${messages["English"].languageUpdated} English`);
    bot.sendMessage(chatId, messages["English"].newPost, {
      reply_markup: createAddButtonsKeyboard("English"),
    });
  } else {
    bot.sendMessage(chatId, messages["Russian"].languageNotSet);
  }
});

// 15. Обработчик команды /newPost
bot.onText(/\/newPost/, (msg) => {
  const chatId = msg.chat.id;
  let userData = readUserData(chatId);

  if (userData && userData.language) {
    if (userData.state === "awaitingAdminApproval") {
      bot.sendMessage(chatId, messages[userData.language].postAwaitingApproval);
    } else {
      bot.sendMessage(chatId, messages[userData.language].newPost, {
        reply_markup: createAddButtonsKeyboard(userData.language),
      });
    }
  } else {
    bot.sendMessage(chatId, messages["Russian"].languageNotSet);
  }
});

// 16. Обработчик команды /addBattle

bot.onText(/\/addBattle/, (msg) => {
  const chatId = msg.chat.id;
  let userData = readUserData(chatId);

  if (userData && userData.language) {
    if (userData.blocked) {
      bot.sendMessage(chatId, messages[userData.language].blockedMessage);
      return;
    }
    if (userData.state === "awaitingAdminApproval") {
      bot.sendMessage(chatId, messages[userData.language].postAwaitingApproval);
    } else {
      clearPostData(chatId); // Очищаем данные перед началом нового процесса
      updateUserState(chatId, "awaitingEventLink"); // Обновляем состояние на awaitingEventLink
      bot.sendMessage(chatId, messages[userData.language].addBattleLink);
    }
  } else {
    bot.sendMessage(chatId, messages["Russian"].languageNotSet);
  }
});

// 17. Обработчик команды /addPractice
bot.onText(/\/addPractice/, (msg) => {
  const chatId = msg.chat.id;
  let userData = readUserData(chatId);

  if (userData && userData.language) {
    if (userData.blocked) {
      bot.sendMessage(chatId, messages[userData.language].blockedMessage);
      return;
    }
    if (userData.state === "awaitingAdminApproval") {
      bot.sendMessage(chatId, messages[userData.language].postAwaitingApproval);
    } else {
      clearPostData(chatId); // Очищаем данные перед началом нового процесса
      updateUserState(chatId, "awaitingPracticeName"); // Предполагается, что у вас есть состояние awaitingPracticeName
      bot.sendMessage(chatId, messages[userData.language].addPractice); // Предполагается, что у вас есть сообщение addPractice
    }
  } else {
    bot.sendMessage(chatId, messages["Russian"].languageNotSet);
  }
});

// 18. Обработчик команды /requestunblock
bot.onText(/\/requestunblock/, async (msg) => {
  const chatId = msg.chat.id;
  let userData = readUserData(chatId);

  if (userData && userData.blocked) {
    const chatInfo = await bot.getChat(chatId);
    const username = chatInfo.username ? `(@${chatInfo.username})` : "";

    const message = await bot.sendMessage(
      ADMIN_CHAT_ID,
      `Запрос от пользователя ID ${chatId} ${username} на разблокировку`
    );
    addBlockUnblockButtons(
      ADMIN_CHAT_ID,
      message.message_id,
      chatId,
      userData.language
    );
    bot.sendMessage(chatId, messages[userData.language].unblockRequestSent);
  } else {
    bot.sendMessage(chatId, messages[userData.language].notBlocked);
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// 19. Обработчик сообщений
// Обработчик сообщений для состояния "awaitingEventLink"
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  let userData = readUserData(chatId);

  if (userData && userData.language) {
    if (text === messages[userData.language].addBattleButton) {
      bot.processUpdate({
        update_id: Math.floor(Math.random() * 1000000), // Генерируем случайный update_id
        message: {
          chat: { id: chatId },
          text: "/addBattle",
        },
      });
      return;
    } else if (text === messages[userData.language].addPracticeButton) {
      bot.processUpdate({
        update_id: Math.floor(Math.random() * 1000000), // Генерируем случайный update_id
        message: {
          chat: { id: chatId },
          text: "/addPractice",
        },
      });
      return;
    }
  }

  if (!userData || !userData.state) return;

  // 20. Проверка, является ли сообщение командой
  if (text && text.startsWith("/")) {
    return;
  }

  if (userData.state === "awaitingAdminApproval") {
    bot.sendMessage(chatId, messages[userData.language].postAwaitingApproval);
    return;
  }

  const stateHandlers = {
    awaitingBattleName: handleAwaitingBattleName,
    awaitingBattleDates: handleAwaitingBattleDates,
    awaitingBattleYear: handleAwaitingBattleYear,
    awaitingBattleLocation: handleAwaitingBattleLocation,
    awaitingBattleDescription: handleAwaitingBattleDescription,
    awaitingBattleLink: handleAwaitingBattleLink,
    awaitingPracticeName: handleAwaitingPracticeName,
    awaitingPracticeLocation: handleAwaitingPracticeLocation,
    awaitingPracticeDescription: handleAwaitingPracticeDescription,
    awaitingPracticeLink: handleAwaitingPracticeLink,
    awaitingEventLink: handleAwaitingEventLink, // Добавляем обработчик для состояния awaitingEventLink
  };

  const handler = stateHandlers[userData.state];
  if (handler) {
    if (
      userData.state === "awaitingBattleDescription" ||
      userData.state === "awaitingPracticeDescription"
    ) {
      if (!msg.text) {
        bot.sendMessage(
          chatId,
          messages[userData.language].textOnlyDescription +
            messages[userData.language][
              userData.state === "awaitingBattleDescription"
                ? "addBattleDescription"
                : "addPracticeDescription"
            ],
          { reply_markup: createSkipKeyboard(userData.language) }
        );
        return;
      }
    }
    handler(msg, chatId, userData);
  }
});

// Обработчик сообщений для состояния "awaitingEventLink"
// Обработчик сообщений для состояния "awaitingEventLink"
async function handleAwaitingEventLink(msg, chatId, userData) {
  const eventLink = msg.text;

  // Логирование ссылки для отладки
  console.log("Event link received:", eventLink);

  // Проверка на валидность URL
  if (!isValidUrl(eventLink)) {
    bot.sendMessage(
      chatId,
      `${messages[userData.language].addBattleLink}\n\n${
        messages[userData.language].invalidLink
      }`
    );
    return;
  }

  try {
    const eventInfo = await extractEventInfo(eventLink, chatId);

    // Прочитать данные пользователя снова после обновления состояния
    const updatedUserData = readUserData(chatId);

    // Формируем сообщение с информацией о событии
    const { message, inlineKeyboard } = createPostMessage(
      updatedUserData,
      true
    );

    // Отправляем итоговое сообщение
    await sendFinalMessage(chatId, updatedUserData);

    // // Отправляем сообщение о готовности поста к публикации
    // await sendPostReadyMessage(chatId, userData.language);

    // Обновляем состояние пользователя на "completed"
    updateUserState(chatId, "completed");

    // Логирование для отладки
    console.log("User state after final update:", readUserData(chatId));
  } catch (error) {
    console.error("Error extracting event info:", error);

    // Сохраняем ссылку в postData
    updateUserState(chatId, "awaitingBattleName", { battleLink: eventLink });

    // Переходим к следующему этапу - запрос названия баттла
    bot.sendMessage(chatId, messages[userData.language].addBattle);
  }
}

// Функция для проверки валидности URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

//////////////////////////////// ОБРАБОТКА СОСТОЯНИЙ  ////////////////////////////////////////////////////////////////////////

// ДЛЯ БАТТЛОВ

// 21. Функция для обработки состояния 'awaitingBattleName'
function handleAwaitingBattleName(msg, chatId, userData) {
  const name = msg.text;

  // Проверка на наличие только букв, цифр, пробелов и дополнительных символов (,()-—. _')
  if (!/^[\p{L}\d\s,()\-—. _']+$/u.test(name)) {
    bot.sendMessage(chatId, messages[userData.language].invalidBattleName);
    return;
  }

  updateUserState(chatId, "awaitingBattleDates", { battleName: name });
  bot.sendMessage(chatId, messages[userData.language].addBattleDates, {
    reply_markup: createDateKeyboard(),
  });
}

// 22. Функция для обработки состояния 'awaitingBattleDates'
function handleAwaitingBattleDates(msg, chatId, userData) {
  if (msg.text.startsWith("/")) return;
  updateUserState(chatId, "awaitingBattleMonth", { battleDates: msg.text });
  bot.sendMessage(chatId, messages[userData.language].addBattleMonth, {
    reply_markup: createMonthKeyboard(userData.language),
  });
}

// 23.   Функция для обработки состояния 'awaitingBattleYear'
function handleAwaitingBattleYear(msg, chatId, userData) {
  if (msg.text.startsWith("/")) return;
  updateUserState(chatId, "awaitingBattleLocation", { battleYear: msg.text });
  bot.sendMessage(chatId, messages[userData.language].addBattleLocation);
}

//  24. Функция для обработки состояния 'awaitingBattleLocation'
async function handleAwaitingBattleLocation(msg, chatId, userData) {
  if (msg.text.startsWith("/")) return;
  const cityName = msg.text;
  const cityCheck = await checkCityExists(cityName);
  if (!cityCheck.exists) {
    bot.sendMessage(
      chatId,
      `${messages[userData.language].cityNotFound}\n\n${
        messages[userData.language].addBattleLocation
      }`
    );
    return;
  }
  updateUserState(chatId, "awaitingBattleDescription", {
    battleLocation: `${cityName}, ${cityCheck.country}`,
  });
  bot
    .sendMessage(chatId, messages[userData.language].addBattleDescription, {
      reply_markup: createSkipKeyboard(userData.language),
    })
    .then((sentMessage) => {
      battleDescriptionMessageId = sentMessage.message_id; // Сохраняем идентификатор сообщения с запросом описания для баттла
    });
}

let battleDescriptionMessageId = null; // Глобальная переменная для хранения идентификатора сообщения с запросом описания для баттла

function handleAwaitingBattleDescription(msg, chatId, userData) {
  if (msg.text && !msg.text.startsWith("/")) {
    updateUserState(chatId, "completed", {
      battleDescription: msg.text,
    });

    // Прочитать данные пользователя снова после обновления состояния
    const updatedUserData = readUserData(chatId);

    // Отправляем сводку постов пользователю
    sendFinalMessage(chatId, updatedUserData);

    // Отправляем сообщение с кнопкой "Опубликовать"
    sendPostReadyMessage(chatId, userData.language);
  } else {
    bot.sendMessage(
      chatId,
      messages[userData.language].textOnlyDescription +
        messages[userData.language].addBattleDescription,
      { reply_markup: createSkipKeyboard(userData.language) }
    );
  }
}

// 26. Функция для обработки состояния 'awaitingBattleLink'
function handleAwaitingBattleLink(msg, chatId, userData) {
  if (msg.text.startsWith("/")) return;
  if (!isValidUrl(msg.text)) {
    bot.sendMessage(
      chatId,
      `${messages[userData.language].addBattleLink}\n\n${
        messages[userData.language].invalidLink
      }`
    );
    return;
  }
  updateUserState(chatId, "completed", { battleLink: msg.text });

  // Прочитать данные пользователя снова после обновления состояния
  const updatedUserData = readUserData(chatId);

  // // Отправляем сводку постов пользователю
  // sendFinalMessage(chatId, updatedUserData);
}

// ДЛЯ ТРЕНИРОВОК /////////////////////////////////////////////////////

// 27. Функция для обработки состояния 'awaitingPracticeName'
function handleAwaitingPracticeName(msg, chatId, userData) {
  const name = msg.text;

  // Проверка на наличие только букв, цифр, пробелов и дополнительных символов (,()-—. _')
  if (!/^[\p{L}\d\s,()\-—. _']+$/u.test(name)) {
    bot.sendMessage(chatId, messages[userData.language].invalidPracticeName);
    return;
  }

  updateUserState(chatId, "awaitingPracticeLocation", { practiceName: name });
  bot.sendMessage(chatId, messages[userData.language].addPracticeLocation);
}

// 28. Функция для обработки состояния 'awaitingPracticeLocation'
async function handleAwaitingPracticeLocation(msg, chatId, userData) {
  if (msg.text.startsWith("/")) return;
  const cityName = msg.text;
  const cityCheck = await checkCityExists(cityName);
  if (!cityCheck.exists) {
    bot.sendMessage(
      chatId,
      `${messages[userData.language].cityNotFound}\n\n${
        messages[userData.language].addPracticeLocation
      }`
    );
    return;
  }
  updateUserState(chatId, "awaitingPracticeDescription", {
    practiceLocation: `${cityName}, ${cityCheck.country}`,
  });
  bot
    .sendMessage(chatId, messages[userData.language].addPracticeDescription, {
      reply_markup: createSkipKeyboard(userData.language),
    })
    .then((sentMessage) => {
      practiceDescriptionMessageId = sentMessage.message_id; // Сохраняем идентификатор сообщения с запросом описания
    });
}

let practiceDescriptionMessageId = null; // Глобальная переменная для хранения идентификатора сообщения с запросом описания

// 29. Функция для обработки состояния 'awaitingPracticeDescription'
function handleAwaitingPracticeDescription(msg, chatId, userData) {
  if (msg.text && !msg.text.startsWith("/")) {
    updateUserState(chatId, "awaitingPracticeLink", {
      practiceDescription: msg.text,
    });
    bot
      .sendMessage(chatId, messages[userData.language].addPracticeLink)
      .then((sentMessage) => {
        if (practiceDescriptionMessageId) {
          bot
            .deleteMessage(chatId, practiceDescriptionMessageId)
            .catch((error) => {
              console.error(
                "Error deleting practice description message:",
                error
              );
            });
        }
      });
  } else {
    bot.sendMessage(
      chatId,
      messages[userData.language].textOnlyDescription +
        messages[userData.language].addPracticeDescription,
      { reply_markup: createSkipKeyboard(userData.language) }
    );
  }
}

// 30. Обновление функции handleAwaitingPracticeLink для запроса ссылки без кнопки "Пропустить"
function handleAwaitingPracticeLink(msg, chatId, userData) {
  if (msg.text.startsWith("/")) return;
  if (!isValidUrl(msg.text)) {
    bot.sendMessage(
      chatId,
      `${messages[userData.language].addPracticeLink}\n\n${
        messages[userData.language].invalidLink
      }`
    );
    return;
  }
  updateUserState(chatId, "completed", { practiceLink: msg.text });

  // Прочитать данные пользователя снова после обновления состояния
  const updatedUserData = readUserData(chatId);

  // Отправляем сводку постов пользователю
  sendPracticeFinalMessage(chatId, updatedUserData);
}

/////////////   SendFunctions SendFunctions SendFunctions SendFunctions SendFunctions /////////////////////////////

// 31. Функция для формирования сообщения для баттла или тренировки
function createPostMessage(userData, isBattle) {
  const userLabels = getLabels(userData.language);
  const titleKey = isBattle ? "battleName" : "practiceName";
  const descriptionKey = isBattle ? "battleDescription" : "practiceDescription";
  const locationKey = isBattle ? "battleLocation" : "practiceLocation";
  const linkKey = isBattle ? "battleLink" : "practiceLink";
  const title = escapeHtml(userData.postData[titleKey].toUpperCase()); // Экранируем символы в названии
  const description = userData.postData[descriptionKey]
    ? `\n<blockquote>${escapeHtml(userData.postData[descriptionKey])
        .split("\n")
        .join("\n> ")
        .replace(/>/g, "")}</blockquote>`
    : ""; // Удаляем лишние символы ">"
  const location = userData.postData[locationKey];
  const link = userData.postData[linkKey];

  let tags;
  if (isBattle) {
    const [datePart, monthYearPart] = userData.postData.battleDates.split("#");
    const fullDate = `${datePart}, ${userData.postData.battleMonth} ${userData.postData.battleYear}`; // Добавляем запятую после числа
    const cityTag = location
      .split(",")[0]
      .replace(/[-–]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
    const monthTag = userData.postData.battleMonth
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
    const yearTag = userData.postData.battleYear;
    tags = `#${cityTag}${monthTag}${yearTag} | #${monthTag}${yearTag}`;
    const battleNameLink = `<a href="${link}">${title}</a>`;
    const formattedLocation = location
      .split(", ")
      .map((part) =>
        part
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      )
      .join(", ");
    const formattedMonth = userData.postData.battleMonth
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    const updatedFullDate = `${datePart}, ${formattedMonth} ${userData.postData.battleYear}`; // Добавляем запятую после числа
    const inlineKeyboard = [
      [{ text: messages[userData.language].moreInfoButton, url: link }],
      [{ text: "+ Add Data", url: `https://t.me/posttobd_bot?start=start` }], // Добавляем кнопку "+ Add Data"
    ];
    const descriptionSection = description
      ? `<b>${userLabels.battle.description}</b>:${description}`
      : ""; // Проверяем наличие описания
    return {
      message: `<b>${
        userLabels.battle.title
      }</b>:     ${battleNameLink}\n\n—\n<b>${
        userLabels.battle.dates
      }</b>:     ${updatedFullDate}\n<b>${
        userLabels.battle.city
      }</b>:     ${formattedLocation}\n•••\n\n${descriptionSection}\n\n<b>${
        messages[userData.language].searchByTag
      }</b>     ${tags}`, // Добавляем длинные пробелы после заголовков и убираем лишнее двоеточие
      inlineKeyboard: inlineKeyboard,
    };
  } else {
    const cityTag = location
      .split(",")[0]
      .replace(/[-–]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
    tags = `#${userLabels.practice.title}${cityTag}`;
    const practiceNameLink = `<a href="${link}">${title}</a>`;
    const formattedLocation = location
      .split(", ")
      .map((part) =>
        part
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      )
      .join(", ");
    const inlineKeyboard = [
      [{ text: messages[userData.language].moreInfoButton, url: link }],
      [{ text: "+ Add Data", url: `https://t.me/posttobd_bot?start=start` }], // Добавляем кнопку "+ Add Data"
    ];
    const descriptionSection = description
      ? `<b>${userLabels.practice.description}</b>:${description}`
      : ""; // Проверяем наличие описания
    return {
      message: `<b>${
        userLabels.practice.title
      }</b>:     ${practiceNameLink}\n\n—\n<b>${
        userLabels.practice.city
      }</b>:     ${formattedLocation}\n•••\n\n${descriptionSection}\n\n<b>${
        messages[userData.language].searchByTag
      }</b>     ${tags}`, // Добавляем длинные пробелы после заголовков и убираем лишнее двоеточие
      inlineKeyboard: inlineKeyboard,
    };
  }
}

// Функция для экранирования HTML-символов
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

async function publishPost(chatId, userData, isBattle) {
  const { message, inlineKeyboard } = createPostMessage(userData, isBattle);
  if (!userData.approved) {
    requestAdminApproval(chatId, userData);
    updateUserState(chatId, "awaitingAdminApproval");
    bot.sendMessage(chatId, messages[userData.language].postAwaitingApproval);
    return;
  }
  try {
    await bot.sendMessage(channelId, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
      parse_mode: "HTML", // Используем HTML-форматирование
    });
    console.log(
      `${
        isBattle ? "Battle" : "Practice"
      } post successfully published to channel.`
    );
  } catch (error) {
    console.error(
      `Error publishing ${isBattle ? "battle" : "practice"} post to channel:`,
      error
    );
    throw error;
  }
  if (postReadyMessageId) {
    bot.deleteMessage(chatId, postReadyMessageId).catch((error) => {
      console.error("Error deleting post ready message:", error);
    });
  }
}

let postReadyMessageId = null; // Глобальная переменная для хранения идентификатора сообщения о готовности поста к публикации

// 33. Обновление функций sendFinalMessage и sendPracticeFinalMessage
function sendPostReadyMessage(chatId, language) {
  const keyboard = {
    inline_keyboard: [
      [{ text: messages[language].publishButton, callback_data: "publish" }],
    ],
  };
  bot
    .sendMessage(chatId, messages[language].postReady, {
      reply_markup: keyboard,
    })
    .then((sentMessage) => {
      postReadyMessageId = sentMessage.message_id; // Сохраняем идентификатор сообщения о готовности поста к публикации
    })
    .catch((error) => {
      console.error("Error sending post ready message:", error);
    });
}

function sendFinalMessage(chatId, userData) {
  const { message, inlineKeyboard } = createPostMessage(userData, true);
  bot
    .sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
      parse_mode: "HTML", // Используем HTML-форматирование
    })
    .then(() => {
      sendPostReadyMessage(chatId, userData.language);
    });
}

function sendPracticeFinalMessage(chatId, userData) {
  const { message, inlineKeyboard } = createPostMessage(userData, false);
  bot
    .sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
      parse_mode: "HTML", // Используем HTML-форматирование
    })
    .then(() => {
      sendPostReadyMessage(chatId, userData.language);
    });
}

// 34. Функция для отправки сообщения о готовности поста к публикации
function sendPostReadyMessage(chatId, language) {
  const keyboard = {
    inline_keyboard: [
      [{ text: messages[language].publishButton, callback_data: "publish" }],
    ],
  };
  bot
    .sendMessage(chatId, messages[language].postReady, {
      reply_markup: keyboard,
    })
    .then((sentMessage) => {
      postReadyMessageId = sentMessage.message_id; // Сохраняем идентификатор сообщения о готовности поста к публикации
    })
    .catch((error) => {
      console.error("Error sending post ready message:", error);
    });
}
// 36. Функция для проверки валидности URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

///////////////КЛАВИАТУРЫ КЛАВИАТУРЫ КЛАВИАТУРЫ КЛАВИАТУРЫ КЛАВИАТУРЫ КЛАВИАТУРЫ КЛАВИАТУРЫ //////////////////

// 37. Функция для создания клавиатуры с кнопками "Добавить баттл" и "Добавить тренировку"
const createAddButtonsKeyboard = (language) => {
  return {
    keyboard: [
      [
        { text: messages[language].addBattleButton },
        { text: messages[language].addPracticeButton },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
};
// 38. Функция для создания клавиатуры с датами
const createDateKeyboard = () => {
  const keyboard = [];
  for (let i = 1; i <= 31; i += 7) {
    const row = [];
    for (let j = i; j < i + 7 && j <= 31; j++) {
      row.push({ text: j.toString(), callback_data: j.toString() });
    }
    keyboard.push(row);
  }
  return { inline_keyboard: keyboard };
};

// 39. Функция для создания клавиатуры с месяцами
const createMonthKeyboard = (language, selectedDate) => {
  const selectedMonths = messages[language].months;
  const keyboard = [];
  for (let i = 0; i < selectedMonths.length; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < selectedMonths.length; j++) {
      row.push({ text: selectedMonths[j], callback_data: selectedMonths[j] });
    }
    keyboard.push(row);
  }
  // Добавляем кнопку "Изменить дату"
  keyboard.push([
    { text: messages[language].changeDateButton, callback_data: "change_date" },
  ]);
  return { inline_keyboard: keyboard };
};

// 40. Функция для создания клавиатуры с годами и кнопкой "Изменить месяц"
const createYearKeyboard = (language) => {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const keyboard = [
    [{ text: currentYear.toString(), callback_data: currentYear.toString() }],
    [{ text: nextYear.toString(), callback_data: nextYear.toString() }],
    [
      {
        text: messages[language].changeMonthButton,
        callback_data: "change_month",
      },
    ], // Используем сообщение в зависимости от языка
  ];
  return { inline_keyboard: keyboard };
};

// 41. Функция для создания клавиатуры с кнопкой "Пропустить"
const createSkipKeyboard = (language) => {
  return {
    inline_keyboard: [
      [
        {
          text: messages[language].skipButton,
          callback_data: "skip_description",
        },
      ],
    ],
  };
};

// 42. Функция для добавления кнопок "Заблокировать" и "Разблокировать" к сообщению
function addBlockUnblockButtons(chatId, messageId, userId, language) {
  const inlineKeyboard = [
    [
      {
        text: messages[language].blockButton,
        callback_data: `block_${userId}`,
      },
    ],
    [
      {
        text: messages[language].unblockButton,
        callback_data: `unblock_${userId}`,
      },
    ],
  ];

  bot.editMessageReplyMarkup(
    {
      inline_keyboard: inlineKeyboard,
    },
    { chat_id: chatId, message_id: messageId }
  );
}

// 43. Функция для получения количества дней в месяце
const getDaysInMonth = (month, language) => {
  const monthIndex = messages[language].months.indexOf(month);
  const daysInMonth = new Date(
    new Date().getFullYear(),
    monthIndex + 1,
    0
  ).getDate();
  return daysInMonth;
};

// 44. Функция для получения индекса месяца
const getMonthIndex = (month, language) => {
  return messages[language].months.indexOf(month);
};

// 45. Функция для проверки, является ли год високосным
const isLeapYear = (year, language) => {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (!isLeap) {
    return messages[language].notLeapYear;
  }
  return null;
};

///////////  Callbackquery Callbackquery Callbackquery Callbackquery Callbackquery /////////////////////////////////////////////////////

//  46. Функция для обработки состояния 'awaitingBattleDates'
function handleAwaitingBattleDatesCallback(
  query,
  chatId,
  messageId,
  selectedValue,
  userData
) {
  updateUserState(chatId, "awaitingBattleMonth", {
    battleDates: selectedValue,
  });
  bot.editMessageText(messages[userData.language].addBattleMonth, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: createMonthKeyboard(userData.language, selectedValue),
  });
}

// 47. Функция для обработки состояния 'awaitingBattleMonth'
function handleAwaitingBattleMonthCallback(
  query,
  chatId,
  messageId,
  selectedValue,
  userData
) {
  if (selectedValue === "change_date") {
    updateUserState(chatId, "awaitingBattleDates");
    bot.editMessageText(messages[userData.language].addBattleDates, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: createDateKeyboard(),
    });
    return;
  }
  const selectedDateForMonth = userData.postData.battleDates;
  const selectedMonthForDates = selectedValue;
  const daysInMonth = getDaysInMonth(selectedMonthForDates, userData.language);
  if (selectedDateForMonth > daysInMonth) {
    bot.answerCallbackQuery(query.id, {
      text: messages[userData.language].invalidDateInMonth
        .replace("${selectedDate}", selectedDateForMonth)
        .replace("${selectedMonth}", selectedMonthForDates),
      show_alert: true,
    });
    return;
  }
  const combinedDate = `${userData.postData.battleDates} #${selectedValue}`;
  updateUserState(chatId, "awaitingBattleYear", {
    battleMonth: selectedValue,
    battleDates: combinedDate,
  });
  bot.editMessageText(messages[userData.language].addBattleYear, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: createYearKeyboard(userData.language),
  }); // Передаем язык пользователя
}

// 48. Функция для обработки состояния 'awaitingBattleYear'
function handleAwaitingBattleYearCallback(
  query,
  chatId,
  messageId,
  selectedValue,
  userData
) {
  if (selectedValue === "change_month") {
    updateUserState(chatId, "awaitingBattleMonth");
    bot.editMessageText(messages[userData.language].addBattleMonth, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: createMonthKeyboard(
        userData.language,
        userData.postData.battleDates
      ),
    });
    return;
  }
  const selectedYear = parseInt(selectedValue);
  const selectedMonthForYear = userData.postData.battleMonth;
  const selectedDateForYear = parseInt(userData.postData.battleDates);

  if (selectedMonthForYear === "Февраль" && selectedDateForYear === 29) {
    const leapYearMessage = isLeapYear(selectedYear, userData.language);
    if (leapYearMessage) {
      bot.answerCallbackQuery(query.id, {
        text: leapYearMessage,
        show_alert: true,
      });
      return;
    }
  }

  const eventDate = new Date(
    selectedYear,
    getMonthIndex(selectedMonthForYear, userData.language),
    selectedDateForYear
  );
  const currentDate = new Date();
  if (eventDate < currentDate) {
    bot.answerCallbackQuery(query.id, {
      text: messages[userData.language].dateAlreadyPassed,
      show_alert: true,
    });
    return;
  }
  const combinedDateYear = `${userData.postData.battleDates}${selectedValue}`;
  updateUserState(chatId, "awaitingBattleLocation", {
    battleYear: selectedValue,
    battleDates: combinedDateYear,
  });
  bot.editMessageText(messages[userData.language].addBattleLocation, {
    chat_id: chatId,
    message_id: messageId,
  });
}

// 49. Функция для обработки состояния 'awaitingBattleDescription'
function handleAwaitingBattleDescriptionCallback(
  query,
  chatId,
  messageId,
  selectedValue,
  userData
) {
  if (selectedValue === "skip_description") {
    updateUserState(chatId, "completed", {
      battleDescription: "Нет описания",
    });

    // Прочитать данные пользователя снова после обновления состояния
    const updatedUserData = readUserData(chatId);

    // Отправляем сводку постов пользователю
    sendFinalMessage(chatId, updatedUserData);

    bot.deleteMessage(chatId, messageId).catch((error) => {
      console.error("Error deleting battle description message:", error);
    });
  }
}

// 50. Функция для обработки состояния 'awaitingPracticeDescription'
function handleAwaitingPracticeDescriptionCallback(
  query,
  chatId,
  messageId,
  selectedValue,
  userData
) {
  if (selectedValue === "skip_description") {
    updateUserState(chatId, "awaitingPracticeLink");
    bot
      .sendMessage(chatId, messages[userData.language].addPracticeLink)
      .then((sentMessage) => {
        if (practiceDescriptionMessageId) {
          bot
            .deleteMessage(chatId, practiceDescriptionMessageId)
            .catch((error) => {
              console.error(
                "Error deleting practice description message:",
                error
              );
            });
        }
      });
  }
}

// 51. Функция для обработки состояния 'completed'
function handleCompletedCallback(
  query,
  chatId,
  messageId,
  selectedValue,
  userData
) {
  if (selectedValue === "publish") {
    if (userData.approved) {
      publishToChannel(chatId, userData)
        .then(() => {
          bot.sendMessage(chatId, messages[userData.language].postPublished); // Отправляем сообщение в чат с учетом выбранного языка
          // После успешной публикации, отправляем сообщение с кнопками "Добавить баттл" и "Добавить тренировку"
          bot.sendMessage(chatId, messages[userData.language].newPost, {
            reply_markup: createAddButtonsKeyboard(userData.language),
          });
        })
        .catch((error) => {
          console.error("Error publishing post:", error);
          bot.sendMessage(
            chatId,
            "Failed to publish post. Please check logs for details."
          );
        });

      // Отправка сообщения администратору
      sendAdminNotification(chatId, userData);
    } else {
      requestAdminApproval(chatId, userData);
      updateUserState(chatId, "awaitingAdminApproval");
      bot.sendMessage(chatId, messages[userData.language].postAwaitingApproval);
    }
  }
}

// Функция для обработки состояния 'awaitingAdminApproval'
function handleAwaitingAdminApprovalCallback(
  query,
  chatId,
  messageId,
  selectedValue,
  userData
) {
  console.log(`Callback query data: ${selectedValue}`); // Логирование данных из callback_query

  const userId = selectedValue.split("_")[1];
  const action = selectedValue.split("_")[0];

  console.log(`Processing admin action: ${action} for userId: ${userId}`); // Логирование действия и userId

  if (action === "approve") {
    console.log(`Reading user data for userId: ${userId}`); // Дополнительное логирование перед чтением данных
    const userData = readUserData(userId); // Используем userId для чтения данных пользователя
    if (!userData) {
      console.log(`User data for userId ${userId} not found.`); // Логирование, если данные не найдены
      bot.sendMessage(
        ADMIN_CHAT_ID,
        `User data for userId ${userId} not found.`
      );
      bot.deleteMessage(ADMIN_CHAT_ID, messageId);
      return;
    } else {
      userData.approved = true;
      console.log(`Writing user data for userId: ${userId}`); // Дополнительное логирование перед записью данных
      writeUserData(userId, userData); // Используем userId для записи данных пользователя
      bot.sendMessage(userId, messages[userData.language].postApproved);
      publishToChannel(userId, userData)
        .then(() => {
          bot.sendMessage(userId, messages[userData.language].postPublished); // Отправляем сообщение в чат с учетом выбранного языка
          // Сбрасываем состояние пользователя после одобрения поста
          updateUserState(userId, null);
        })
        .catch((error) => {
          console.error("Error publishing post:", error);
          bot.sendMessage(
            userId,
            "Failed to publish post. Please check logs for details."
          );
        });
    }
  } else if (action === "reject") {
    bot.sendMessage(userId, messages[userData.language].postRejected);
  }

  bot.deleteMessage(ADMIN_CHAT_ID, messageId);
}

// 53. Функция для обработки блокировки/разблокировки пользователя
function handleBlockUnblockCallback(query, chatId, messageId, selectedValue) {
  const userId = selectedValue.split("_")[1];
  const action = selectedValue.split("_")[0];

  let userData = readUserData(userId);
  if (!userData) {
    userData = { chatId: userId, blocked: false };
  }

  if (action === "block") {
    userData.blocked = true;
    // Отправка сообщения пользователю о блокировке
    if (userData.language) {
      bot.sendMessage(userId, messages[userData.language].blockedMessage);
    } else {
      bot.sendMessage(userId, messages["Russian"].blockedMessage); // По умолчанию на русском, если язык не установлен
    }
  } else if (action === "unblock") {
    userData.blocked = false;
    // Отправка сообщения пользователю о разблокировке
    if (userData.language) {
      bot.sendMessage(userId, messages[userData.language].notBlocked);
    } else {
      bot.sendMessage(userId, messages["Russian"].notBlocked); // По умолчанию на русском, если язык не установлен
    }
  }

  writeUserData(userId, userData);
  bot.answerCallbackQuery(query.id, {
    text: `User ${userId} has been ${
      action === "block" ? "blocked" : "unblocked"
    }.`,
    show_alert: true,
  });
  bot.deleteMessage(chatId, messageId);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////

// 54. Функция для отправки сообщения администратору
async function sendAdminNotification(chatId, userData) {
  try {
    const chatInfo = await bot.getChat(chatId);
    const username = chatInfo.username ? `(@${chatInfo.username})` : "";

    const inlineKeyboard = [
      [
        {
          text: messages[userData.language].blockButton,
          callback_data: `block_${chatId}`,
        },
      ],
      [
        {
          text: messages[userData.language].unblockButton,
          callback_data: `unblock_${chatId}`,
        },
      ],
    ];

    // Отправка поста администратору
    await sendPostToAdmin(chatId, userData);

    // Отправка сообщения с кнопками администратору
    bot.sendMessage(
      ADMIN_CHAT_ID,
      `${messages[userData.language].postFromUser} ${chatId} ${username}`,
      {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }
    );
  } catch (error) {
    console.error("Error sending admin notification:", error);
  }
}

// 55. Обновление функции sendPostToAdmin
async function sendPostToAdmin(chatId, userData) {
  const isBattle = userData.postData.battleName;
  const isPractice = userData.postData.practiceName;
  if (isBattle) {
    const { message, inlineKeyboard } = createPostMessage(userData, true);
    await bot.sendMessage(ADMIN_CHAT_ID, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
      parse_mode: "HTML",
    });
  } else if (isPractice) {
    const { message, inlineKeyboard } = createPostMessage(userData, false);
    await bot.sendMessage(ADMIN_CHAT_ID, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
      parse_mode: "HTML",
    });
  } else {
    console.error("Unknown post type");
  }
}

// 56. Публикация постов на канал
async function publishToChannel(chatId, userData) {
  const isBattle = userData.postData.battleName;
  const isPractice = userData.postData.practiceName;

  if (isBattle) {
    await publishPost(chatId, userData, true);

    // Логирование для отладки
    const {
      battleName,
      battleDates,
      battleMonth,
      battleYear,
      battleLocation,
      battleLink,
    } = userData.postData;
    console.log("Battle Month:", battleMonth); // Проверка значения battleMonth
    console.log("User Language:", userData.language); // Проверка языка пользователя

    // Проверка, если язык существует в months
    if (!battleMonth || !months[userData.language]) {
      console.error("Invalid battleMonth or unsupported language");
      throw new Error("Invalid battleMonth or unsupported language");
    }

    const day = battleDates.split(" ")[0];
    const monthIndex = months[userData.language].indexOf(battleMonth) + 1; // Использование правильного массива месяцев

    if (monthIndex === 0) {
      console.error("Month not found in the array");
      throw new Error("Month not found in the array");
    }

    const locationParts = battleLocation.split(",");
    const city = locationParts[0];
    const country = locationParts[1] ? locationParts[1].trim() : "";

    const eventData = {
      day,
      month: monthIndex, // Преобразованный индекс месяца
      year: battleYear.slice(-2),
      city,
      country,
      eventName: battleName,
      link: battleLink,
    };

    saveEventData(eventData, userData.language); // Передаем язык пользователя
  } else if (isPractice) {
    await publishPost(chatId, userData, false);

    // Логирование для отладки
    const { practiceName, practiceLocation, practiceLink } = userData.postData;
    console.log("Practice Name:", practiceName); // Проверка значения practiceName
    console.log("User Language:", userData.language); // Проверка языка пользователя

    // Тренировки не записываются в файл eventsdata.txt
    console.log("Practice data not saved to eventsdata.txt");
  } else {
    console.error("Unknown post type");
    throw new Error("Unknown post type");
  }
}

// 57. Основной обработчик callback-запросов

// const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Убедитесь, что у вас есть этот ID в .env

// Основной обработчик callback-запросов
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const selectedValue = query.data;

  console.log(
    `Callback query received: chatId=${chatId}, messageId=${messageId}, selectedValue=${selectedValue}`
  );

  let userId;
  if (
    selectedValue.startsWith("approve_") ||
    selectedValue.startsWith("reject_")
  ) {
    userId = selectedValue.split("_")[1];
  } else {
    userId = chatId;
  }

  console.log(`Reading user data for userId=${userId}`);
  let userData = readUserData(userId);
  console.log(`User data read:`, userData);

  if (!userData || !userData.state) {
    console.log(`User data not found or state is not set for userId=${userId}`);
    return;
  }

  const callbackHandlers = {
    awaitingBattleDates: handleAwaitingBattleDatesCallback,
    awaitingBattleMonth: handleAwaitingBattleMonthCallback,
    awaitingBattleYear: handleAwaitingBattleYearCallback,
    awaitingBattleDescription: handleAwaitingBattleDescriptionCallback,
    completed: handleCompletedCallback,
    awaitingPracticeDescription: handleAwaitingPracticeDescriptionCallback,
    awaitingAdminApproval: handleAwaitingAdminApprovalCallback,
    blockUnblock: handleBlockUnblockCallback, // Добавляем новый обработчик
  };

  const handlerKey =
    selectedValue.startsWith("block_") || selectedValue.startsWith("unblock_")
      ? "blockUnblock"
      : userData.state;
  const handler = callbackHandlers[handlerKey];
  if (handler) {
    console.log(`Processing callback for state=${handlerKey}`);
    handler(query, chatId, messageId, selectedValue, userData);
  } else {
    console.log(`No handler found for state=${handlerKey}`);
  }
  bot.answerCallbackQuery(query.id);
});
////////////////////////////////////

// Обработчик команды /makeapost
bot.onText(/\/makeapost/, async (msg) => {
  console.log("Запуск команды /makeapost");
  const filePath = "events_data.json";

  try {
    // Проверяем, существует ли файл с данными
    if (fs.existsSync(filePath)) {
      const events = JSON.parse(fs.readFileSync(filePath, "utf8"));

      // Ищем первое не опубликованное мероприятие
      for (const event of events) {
        const isPublished = await isEventPublished(event);
        if (!isPublished) {
          await sendEventPost(bot, event);
          bot.sendMessage(
            msg.chat.id,
            `Мероприятие "${event.name}" успешно отправлено на канал.`
          );
          saveEventData(event); // Сохраняем данные опубликованного поста
          break; // Прерываем цикл после публикации первого не опубликованного поста
        }
      }
    } else {
      bot.sendMessage(msg.chat.id, "Файл с данными о мероприятиях не найден.");
    }
  } catch (error) {
    console.error("Ошибка при чтении данных:", error);
    bot.sendMessage(
      msg.chat.id,
      "Произошла ошибка при чтении данных о мероприятиях."
    );
  }
});

// Функция для проверки, было ли мероприятие уже опубликовано
async function isEventPublished(event) {
  const publishedEventsFilePath = "eventsData.txt";

  // Проверяем, существует ли файл с опубликованными постами
  if (!fs.existsSync(publishedEventsFilePath)) {
    return false;
  }

  // Читаем данные из файла с опубликованными постами
  const publishedEvents = fs
    .readFileSync(publishedEventsFilePath, "utf8")
    .split("\n");

  // Проверяем, был ли этот пост уже опубликован
  return publishedEvents.some((publishedEvent) => {
    const eventParts = publishedEvent.split(" / ");
    return eventParts[2] === event.name;
  });
}

// Настройка планировщика задач для команды /makeapost
cron.schedule("6 10 * * *", async () => {
  console.log("Запуск задачи по выполнению команды /makeapost");
  const filePath = "events_data.json";

  try {
    // Проверяем, существует ли файл с данными
    if (fs.existsSync(filePath)) {
      const events = JSON.parse(fs.readFileSync(filePath, "utf8"));

      // Ищем первое не опубликованное мероприятие
      for (const event of events) {
        const isPublished = await isEventPublished(event);
        if (!isPublished) {
          await sendEventPost(bot, event);
          console.log(
            `Мероприятие "${event.name}" успешно отправлено на канал.`
          );
          saveEventData(event); // Сохраняем данные опубликованного поста
          break; // Прерываем цикл после публикации первого не опубликованного поста
        }
      }
    } else {
      console.log("Файл с данными о мероприятиях не найден.");
    }
  } catch (error) {
    console.error("Ошибка при чтении данных:", error);
  }
});

// Настройка планировщика задач для извлечения и сохранения данных о мероприятиях
cron.schedule("0 0 * * *", async () => {
  console.log("Запуск задачи по извлечению и сохранению данных о мероприятиях");
  const url = "https://example.com/events"; // Замените на реальный URL
  const filePath = "events_data.json";
  await saveEventsData(url, filePath);
});

// Пример использования
const url = "https://www.bboybattles.org/battles.aspx"; // Замените на реальный URL
const filePath = "events_data.json";
saveEventsData(url, filePath);
