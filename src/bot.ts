import 'dotenv/config';
import { Telegraf, Markup, session, Scenes } from 'telegraf';
import type { Context } from 'telegraf';
import { createSurveyScene } from './scenes/survey.js';

const token = '7988677028:AAENoK3vloZjettOA0A_Q2Gird9T47HEyxE';

const bot = new Telegraf(token);
const stage = new Scenes.Stage([createSurveyScene()]);
bot.use(session());
bot.use(stage.middleware());

function startKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Начать', 'start:begin')],
  ]);
}

// questions are asked inside the wizard scene

bot.start(async (ctx: Context) => {
  await ctx.reply(
    'Привет! Я бот-опрос. Нажмите кнопку, чтобы начать.',
    startKeyboard()
  );
});

bot.action('start:begin', async (ctx: Context) => {
  await ctx.answerCbQuery();
  // Прячем клавиатуру у нажатого сообщения
  try {
    await (ctx as any).editMessageReplyMarkup(undefined as any);
  } catch {}
  await (ctx as any).scene.enter('survey');
});

// Дополнительные команды для перезапуска опроса
bot.command(['restart', 'again'], async (ctx: Context) => {
  await (ctx as any).scene.enter('survey');
});

// handlers for answers live inside the scene now

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
