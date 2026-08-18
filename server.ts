import { resolve, sep } from "node:path";

const root = import.meta.dir;
const port = Number(Bun.argv[2] ?? Bun.env.PORT ?? 4321);
const telegramToken = Bun.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = Bun.env.TELEGRAM_CHAT_ID;
const requests = new Map<string, number[]>();

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Порт должен быть целым числом от 1 до 65535");
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/lead" && request.method === "POST") {
      if (!telegramToken || !telegramChatId) {
        console.error("Не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID");
        return Response.json({ error: "Сервис отправки не настроен" }, { status: 503 });
      }

      const ip = server.requestIP(request)?.address ?? "unknown";
      const now = Date.now();
      const recent = (requests.get(ip) ?? []).filter(time => now - time < 60_000);
      if (recent.length >= 5) {
        return Response.json({ error: "Слишком много заявок. Попробуйте через минуту" }, { status: 429 });
      }
      recent.push(now);
      requests.set(ip, recent);

      let data: Record<string, unknown>;
      try {
        data = await request.json();
      } catch {
        return Response.json({ error: "Некорректные данные" }, { status: 400 });
      }

      const clean = (value: unknown, max: number) =>
        String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
      const name = clean(data.name, 80);
      const phone = clean(data.tel, 30);
      const contact = clean(data.contact, 120);
      const comment = clean(data.msg, 1000);

      if (name.length < 2 || phone.replace(/\D/g, "").length !== 11) {
        return Response.json({ error: "Проверьте имя и номер телефона" }, { status: 422 });
      }

      const text = [
        "КУРС",
        `Имя: ${name}`,
        `Телефон: ${phone}`,
        `Telegram или e-mail: ${contact || "—"}`,
        `Комментарий: ${comment || "—"}`,
      ].join("\n");

      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: telegramChatId, text }),
        });
        if (!telegramResponse.ok) throw new Error(`Telegram API: ${telegramResponse.status}`);
      } catch (error) {
        console.error("Не удалось отправить заявку:", error);
        return Response.json({ error: "Не удалось отправить заявку" }, { status: 502 });
      }

      return Response.json({ ok: true });
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Метод не найден" }, { status: 404 });
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Некорректный URL", { status: 400 });
    }

    const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = resolve(root, requestedPath);

    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      return new Response("Доступ запрещён", { status: 403 });
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("Страница не найдена", { status: 404 });
    }

    return new Response(file, {
      headers: { "Cache-Control": "no-cache" },
    });
  },
});

console.log(`Сайт запущен: http://localhost:${server.port}`);
if (!telegramToken || !telegramChatId) {
  console.warn("Telegram не настроен: заполните TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env");
}
