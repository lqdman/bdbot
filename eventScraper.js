const puppeteer = require("puppeteer");
const fs = require("fs");

// Функция для экранирования HTML-символов
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Массив с названиями месяцев
const monthNames = [
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
];

// Функция для преобразования числовых месяцев в текстовые
function getMonthName(month) {
  return monthNames[month - 1];
}

async function fetchEventsData(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    // Открытие страницы
    await page.goto(url, { waitUntil: "networkidle2" });

    // Ожидание загрузки данных (если известно, что данные загружаются после определенного события)
    // Например, можно ожидать появления элемента с определенным селектором
    await page.waitForSelector(
      "div.Row.BattleList_Row, div.Row.BattleList_AltRow"
    );

    // Извлечение данных
    const events = await page.evaluate(() => {
      const events = [];

      document
        .querySelectorAll("div.Row.BattleList_Row, div.Row.BattleList_AltRow")
        .forEach((element) => {
          const dateElement = element.querySelector(
            "div.Column.BattleList_Item.ColumnDate span"
          );
          const nameLinkElement = element.querySelector(
            "div.Column.BattleList_Item.ColumnName a.BattleList_Item"
          );
          const locationElement = element.querySelector(
            "div.Column.BattleList_Item.ColumnLocation span"
          );
          const formatElement = element.querySelector(
            "div.Column.BattleList_Item.ColumnFormat span"
          );

          if (
            dateElement &&
            nameLinkElement &&
            locationElement &&
            formatElement
          ) {
            const date = dateElement.textContent.trim();
            const name = nameLinkElement.textContent.trim();
            const link = nameLinkElement.href;
            const location = locationElement.textContent.trim();
            const format = formatElement.textContent.trim();

            const event = {
              date,
              name,
              link,
              location,
              format,
            };

            events.push(event);
          } else {
            console.warn(
              "Пропущен элемент, так как один из селекторов вернул null:",
              element
            );
          }
        });

      return events;
    });

    console.log("Полученные данные:", events); // Добавьте это для отладки
    return events;
  } catch (error) {
    console.error("Ошибка при загрузке данных:", error);
    return [];
  } finally {
    await browser.close();
  }
}

async function saveEventsData(url, filePath) {
  const events = await fetchEventsData(url);
  console.log("Данные, которые будут сохранены:", events); // Добавьте это для отладки

  try {
    // Перезаписываем файл новыми данными
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
    console.log("Данные успешно перезаписаны в файл");
  } catch (error) {
    console.error("Ошибка при сохранении данных:", error);
  }
}

function createEventPostMessage(eventData) {
  const title = escapeHtml(eventData.name.toUpperCase()); // Экранируем символы в названии
  const description = eventData.format
    ? `\n<blockquote>${escapeHtml(eventData.format)
        .split("\n")
        .join("\n> ")
        .replace(/>/g, "")}</blockquote>`
    : ""; // Удаляем лишние символы ">"
  const location = eventData.location;
  const link = eventData.link;
  const dateParts = eventData.date.split(".");
  const day = dateParts[0];
  const month = getMonthName(parseInt(dateParts[1], 10));
  const year = dateParts[2];

  const cityTag = location
    .split(",")[0]
    .replace(/[-–]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
  const monthTag = month
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
  const yearTag = year;
  const tags = `#${cityTag}${monthTag}${yearTag} | #${monthTag}${yearTag}`;
  const eventNameLink = `<a href="${link}">${title}</a>`;
  const formattedLocation = location
    .split(", ")
    .map((part) =>
      part
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    )
    .join(", ");
  const updatedFullDate = `${day}, ${month} ${year}`; // Добавляем запятую после числа
  const inlineKeyboard = [
    [{ text: "Check it out", url: link }],
    [{ text: "+ Add Data", url: `https://t.me/posttobd_bot?start=start` }], // Добавляем кнопку "+ Add Data"
  ];
  const descriptionSection = description
    ? `<b>Description</b>:${description}`
    : ""; // Проверяем наличие описания
  return {
    message: `<b>Battle</b>:     ${eventNameLink}\n\n—\n<b>Date</b>:     ${updatedFullDate}\n<b>Location</b>:     ${formattedLocation}\n•••\n\n${descriptionSection}\n\n<b>Search by Tag</b>     ${tags}`, // Добавляем длинные пробелы после заголовков и убираем лишнее двоеточие
    inlineKeyboard: inlineKeyboard,
  };
}

async function sendEventPost(bot) {
  const eventsDataFilePath = "events_data.json";
  const publishedEventsFilePath = "eventsData.txt";

  // Проверяем, существуют ли файлы с данными
  if (
    !fs.existsSync(eventsDataFilePath) ||
    !fs.existsSync(publishedEventsFilePath)
  ) {
    console.log("Файлы с данными не найдены.");
    return;
  }

  // Читаем данные из файлов
  const events = JSON.parse(fs.readFileSync(eventsDataFilePath, "utf8"));
  const publishedEvents = fs
    .readFileSync(publishedEventsFilePath, "utf8")
    .split("\n");

  // Проверяем каждый пост из events_data.json
  for (const event of events) {
    const isPublished = publishedEvents.some((publishedEvent) => {
      const eventParts = publishedEvent.split(" / ");
      return eventParts[2] === event.name;
    });

    if (!isPublished) {
      const post = createEventPostMessage(event);
      await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, post.message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: post.inlineKeyboard },
      });

      // Сохраняем данные опубликованного поста в файл
      saveEventData(event);
      break; // Прерываем цикл после публикации первого не опубликованного поста
    }
  }
}

// Функция для сохранения данных опубликованного поста в файл
function saveEventData(eventData) {
  const filePath = "eventsData.txt";
  const dateParts = eventData.date.split(".");
  const day = dateParts[0];
  const month = dateParts[1];
  const year = dateParts[2].slice(-2); // Берем только две последние цифры года
  const location = eventData.location;
  const name = eventData.name;
  const link = eventData.link;
  const language = "English"; // Указываем язык как English

  const eventString = `${day}. ${month}. ${year} / ${location} / ${name} / ${link} / ${language}\n`;

  try {
    if (fs.existsSync(filePath)) {
      // Читаем существующие данные из файла
      const existingData = fs.readFileSync(filePath, "utf8");
      // Добавляем новую строку к существующим данным
      const updatedData = existingData + eventString;
      // Перезаписываем файл с обновленными данными
      fs.writeFileSync(filePath, updatedData);
    } else {
      // Если файл не существует, создаем его и сохраняем данные
      fs.writeFileSync(filePath, eventString);
    }
    console.log("Данные опубликованного поста успешно сохранены в файл");
  } catch (error) {
    console.error("Ошибка при сохранении данных опубликованного поста:", error);
  }
}

module.exports = {
  fetchEventsData,
  saveEventsData,
  createEventPostMessage,
  sendEventPost,
};
