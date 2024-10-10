const axios = require("axios");
const fs = require("fs");

// Ваш токен доступа к API ВКонтакте
const VK_ACCESS_TOKEN =
  "vk1.a.qz20sRc7o_genwxKRptCOcI0nG4wuvtbVMdV3ZE5Ncce-BB_RShTQZCEiae9K1PXLjpYflq8rh-Aw106NLKIjMGWEdG9GBtMKM3pON-I9MAEsh5kf7G1SBz0GEsyTsgTs2LvQZ5qyhDErYAOcGxSDAaS59pehE0yOQ9YwXPw155RuAIhsY9kCv6CJ_lWjX-XsOCEwKGEigStCPGbQVrhDg";

// Функция для извлечения информации из ссылки на группу, паблик или событие
async function extractEventInfo(url, chatId) {
  try {
    // Определяем тип объекта (группа, паблик, событие)
    let objectType, objectId;

    if (url.includes("vk.com/event")) {
      objectType = "event";
      objectId = url.split("event")[1];
    } else if (url.includes("vk.com/club")) {
      objectType = "group";
      objectId = url.split("club")[1];
    } else if (url.includes("vk.com/public")) {
      objectType = "group";
      objectId = url.split("public")[1];
    } else if (url.includes("vk.com/")) {
      objectType = "group";
      objectId = url.split("vk.com/")[1];
    } else {
      throw new Error("Unsupported URL type");
    }

    // Формируем URL для запроса к API ВКонтакте с дополнительными полями
    const apiUrl = `https://api.vk.com/method/groups.getById?group_id=${objectId}&fields=description,place,start_date,address,city&access_token=${VK_ACCESS_TOKEN}&v=5.131`;

    // Выполняем запрос к API ВКонтакте
    const response = await axios.get(apiUrl);

    // Логируем ответ от API ВКонтакте
    console.log("VK API Response:", response.data);

    // Извлекаем необходимую информацию
    const eventInfo = response.data.response[0];
    const eventName = eventInfo.name;
    const eventDescription = eventInfo.description || "Не указано";
    const eventPlace = eventInfo.place
      ? eventInfo.place.title
      : eventInfo.address ||
        (eventInfo.city ? eventInfo.city.title : "Не указано");
    const eventDate = eventInfo.start_date
      ? new Date(eventInfo.start_date * 1000).toLocaleString()
      : "Не указано";

    // Извлекаем дату, месяц и год из даты события
    const eventDateObj = new Date(eventInfo.start_date * 1000);
    const eventDay = eventDateObj.getDate();
    const eventMonth = eventDateObj.getMonth();
    const eventYear = eventDateObj.getFullYear();

    // Преобразуем месяц в текстовое значение
    const months = [
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
    ];
    const eventMonthText = months[eventMonth];

    // Формируем дату в нужном формате
    const formattedDate = `${eventDay} #${eventMonthText}${eventYear}`;

    // Обновляем данные пользователя
    updateUserState(chatId, "completed", {
      battleName: eventName,
      battleDates: formattedDate,
      battleMonth: eventMonthText,
      battleYear: eventYear.toString(),
      battleLocation: eventPlace,
      battleDescription: eventDescription,
      battleLink: url,
    });

    return {
      name: eventName,
      description: eventDescription,
      place: eventPlace,
      date: eventDate,
    };
  } catch (error) {
    console.error("Error extracting event info:", error);
    throw error;
  }
}

// Функция для чтения данных из файла
const readUserData = (chatId) => {
  try {
    const data = fs.readFileSync(`users/${chatId}.json`, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
};

// Функция для записи данных в файл
const writeUserData = (chatId, data) => {
  fs.writeFileSync(`users/${chatId}.json`, JSON.stringify(data, null, 2));
};

// Функция для обновления состояния пользователя
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

// Экспортируем функцию
module.exports = {
  extractEventInfo,
};
