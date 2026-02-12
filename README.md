Setup

1. Create a bot via @BotFather and get the token.
2. Create a .env file in project root:

```
TELEGRAM_BOT_TOKEN=123456:ABC...
```

3. Install dependencies and run:

```
npm install
npm run dev
```

What it does

- Sends greeting with inline "Начать" button on /start.
- Runs a survey defined in src/questions/questions.ts.
- Supports multiple choice and date via inline calendar.

Files

- src/bot.ts — bot wiring and handlers
- src/questions/types.ts — question types
- src/questions/questions.ts — survey list
- src/keyboard/calendar.ts — inline calendar keyboard
- src/state/session.ts — in-memory survey state
