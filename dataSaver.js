const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const DATA_FILE_PATH = path.join(__dirname, "eventsData.txt");

const months = {
  Russian: [
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
  English: [
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
};

// Функция для экранирования символов в соответствии с требованиями HTML
function escapeHtml(text) {
  return text.replace(/([<>&"'])/g, function (match) {
    switch (match) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return match;
    }
  });
}

// Функция для приведения первой буквы строки к верхнему регистру
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
  months, // Экспортируем переменную months
  saveEventData: (eventData, language) => {
    const { day, month, year, city, country, eventName, link } = eventData;

    // Форматирование даты
    const formattedDay = day.padStart(2, "0");
    const formattedMonth = month.toString().padStart(2, "0");
    const formattedYear = year.slice(-2);
    const formattedDate = `${formattedDay}. ${formattedMonth}. ${formattedYear}`;

    // Форматирование строки для записи в файл
    const eventLine = `${formattedDate} / ${city}, ${country} / ${eventName} / ${link} / ${language}\n`;

    try {
      fs.appendFileSync(DATA_FILE_PATH, eventLine, "utf8");
      console.log("Event data saved successfully:", eventLine);
    } catch (error) {
      console.error("Error saving event data:", error);
    }
  },

  getEventData: () => {
    try {
      if (!fs.existsSync(DATA_FILE_PATH)) {
        return "No events found.";
      }
      const data = fs.readFileSync(DATA_FILE_PATH, "utf8");
      return data;
    } catch (error) {
      console.error("Error reading event data:", error);
      return "Error reading event data.";
    }
  },

  getEventsForThisWeek: () => {
    try {
      if (!fs.existsSync(DATA_FILE_PATH)) {
        return { ruEvents: [], enEvents: [] };
      }
      const data = fs.readFileSync(DATA_FILE_PATH, "utf8");
      const events = data.split("\n").filter((line) => line.trim() !== "");

      // Получаем текущую дату
      const today = new Date();
      const dayOfWeek = today.getDay(); // День недели (0 - Воскресенье, 6 - Суббота)

      // Корректируем даты на начало и конец недели
      // Начало недели: понедельник текущей недели
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7)); // Рассчитываем с понедельника

      // Конец недели: воскресенье текущей недели
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Воскресенье — конец недели

      // Устанавливаем время для начала и конца недели
      startOfWeek.setHours(0, 0, 0, 0); // 00:00:00.000
      endOfWeek.setHours(23, 59, 59, 999); // 23:59:59.999

      console.log("Start of week:", startOfWeek.toISOString());
      console.log("End of week:", endOfWeek.toISOString());

      // Фильтрация событий на этой неделе
      const eventsForThisWeek = events.filter((event) => {
        const [datePart, locationPart, eventName, link, language] =
          event.split(" / ");
        const [day, month, year] = datePart
          .split(". ")
          .map((part) => parseInt(part, 10));
        const eventDate = new Date(2000 + year, month - 1, day);

        // Сравнение только по датам без учёта времени
        return eventDate >= startOfWeek && eventDate <= endOfWeek;
      });

      eventsForThisWeek.sort((a, b) => {
        const [dateA] = a.split(" / ");
        const [dateB] = b.split(" / ");
        return new Date(dateA) - new Date(dateB);
      });

      const formattedEvents = eventsForThisWeek.map((event) => {
        const [datePart, locationPart, eventName, link, language] =
          event.split(" / ");
        const [day, month] = datePart
          .split(". ")
          .map((part) => parseInt(part, 10));
        const [city] = locationPart.split(",");
        const capitalizedCity = capitalizeFirstLetter(city.trim());
        const eventTitleLink = `<a href="${link}"><b>• ${escapeHtml(
          eventName
        )}</b></a>`;
        const formattedDate = `<b>${day}. ${month}</b>`;
        const formattedEvent = `${formattedDate} • ${escapeHtml(
          capitalizedCity
        )}\n${eventTitleLink}`;

        return { formattedEvent, language };
      });

      const ruEvents = formattedEvents
        .filter((event) => event.language === "Russian")
        .map((event) => event.formattedEvent);
      const enEvents = formattedEvents
        .filter((event) => event.language === "English")
        .map((event) => event.formattedEvent);

      return { ruEvents, enEvents };
    } catch (error) {
      console.error("Error reading event data:", error);
      return { ruEvents: [], enEvents: [] };
    }
  },

  deletePastEvents: () => {
    try {
      if (!fs.existsSync(DATA_FILE_PATH)) {
        console.log("No events file found.");
        return;
      }

      const data = fs.readFileSync(DATA_FILE_PATH, "utf8");
      const events = data.split("\n").filter((line) => line.trim() !== "");

      // Получаем текущую дату
      const today = new Date();
      console.log("Current date:", today.toISOString());

      // Фильтрация событий, которые еще не прошли
      const futureEvents = events.filter((event) => {
        const [datePart, locationPart, eventName, link, language] =
          event.split(" / ");
        const [day, month, year] = datePart
          .split(". ")
          .map((part) => parseInt(part, 10));
        const eventDate = new Date(2000 + year, month - 1, day);
        console.log("Event date:", eventDate.toISOString());

        // Сравнение только по датам без учёта времени
        return eventDate >= today;
      });

      // Запись оставшихся событий обратно в файл
      fs.writeFileSync(DATA_FILE_PATH, futureEvents.join("\n") + "\n", "utf8");
      console.log("Past events deleted successfully.");
    } catch (error) {
      console.error("Error deleting past events:", error);
    }
  },

  // Функция для отправки списка событий на этой неделе
  sendEventsForThisWeek: async (bot, channelId) => {
    try {
      // Удаляем прошедшие события перед отправкой
      module.exports.deletePastEvents();

      const eventsForThisWeek = module.exports.getEventsForThisWeek();

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
  },

  // Настройка задачи по расписанию
  scheduleEventsForThisWeek: (bot, channelId) => {
    cron.schedule("8 10 * * 2", () => {
      console.log("Running sendEventsForThisWeek task on Monday at 10:08");
      module.exports.sendEventsForThisWeek(bot, channelId);
    });
  },
};
