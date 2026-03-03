import dotenv from "dotenv";
dotenv.config();

// Підтягуємо ключі з того ж .env файлу
const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNTID;
const API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_APITOKEN;

const LIST_PREFIX = "CGPS List";

const headers = {
  Authorization: `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
};

async function createGatewayPolicy() {
  if (!ACCOUNT_ID || !API_TOKEN) {
    console.error(
      "Помилка: Не знайдено CLOUDFLARE_ACCOUNT_ID або CLOUDFLARE_API_TOKEN у файлі .env",
    );
    return;
  }

  try {
    console.log("Отримуємо списки з Cloudflare...");
    const listsUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/lists`;

    const listsResponse = await fetch(listsUrl, { headers });
    if (!listsResponse.ok) {
      throw new Error(
        `API Error fetching lists: ${await listsResponse.text()}`,
      );
    }

    const listsData = await listsResponse.json();
    const allLists = listsData.result || [];

    // Знаходимо всі 50 списків
    const targetLists = allLists.filter((lst) =>
      lst.name.startsWith(LIST_PREFIX),
    );

    if (targetLists.length === 0) {
      console.log(
        `Списки з префіксом '${LIST_PREFIX}' не знайдено. Перевірте, чи успішно відпрацював основний скрипт.`,
      );
      return;
    }

    console.log(
      `Знайдено ${targetLists.length} списків. Формуємо wirefilter правило...`,
    );

    // Створюємо масив виразів: any(dns.domains[*] in $list_id)
    const expressions = targetLists.map(
      (lst) => `any(dns.domains[*] in $${lst.id})`,
    );

    // Зшиваємо їх оператором 'or'
    const trafficExpression = expressions.join(" or ");

    const rulesUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/rules`;
    const payload = {
      name: "Pi-hole Ultimate Block",
      description:
        "Автоматично згенерована політика на основі Node.js скрипта (ESM)",
      action: "block",
      traffic: trafficExpression,
      enabled: true,
      precedence: 1, // Найвищий пріоритет
    };

    console.log("Відправляємо запит на створення політики...");
    const ruleResponse = await fetch(rulesUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (!ruleResponse.ok) {
      throw new Error(`API Error creating rule: ${await ruleResponse.text()}`);
    }

    console.log(
      "Успіх! Політику 'Pi-hole Ultimate Block' успішно створено і активовано на вашому Gateway.",
    );
  } catch (error) {
    console.error("Виникла помилка:", error.message);
  }
}

createGatewayPolicy();
