const { Markup } = require('telegraf');
const { logStep } = require('../utils/logger');
const {
  initWatcher,
  handleUserChoice,
  shouldOfferReset,
  resetWatcher, // добавили
} = require('../utils/middlewareHelpers');

async function stuckWatcherMiddleware(ctx, next) {
  if (!ctx.session) ctx.session = {};
  const session = ctx.session;
  const watcher = initWatcher(session);
  console.log(
    'jlfkgjdfskgdsgfdjsfgjsdffgjsdfklgjdfsgkljdfsgkldfjsgkldsjgdfklgjfdskl dfgjdfgjdklgjdskl;gjsd'
  );

  // Проверяем команду /reset до всего остального
  if (ctx.message && ctx.message.text === '/reset') {
    await resetWatcher(ctx.session);
    await ctx.scene.leave();
    await ctx.scene.enter('TOUR_QUESTIONNAIRE');
    return; // завершаем выполнение middleware
  }

  const stepIndex = ctx.wizard.cursor;
  const stepKey = `step_${stepIndex}`;
  const now = Date.now();

  watcher.retries[stepKey] ??= 0;
  watcher.lastStepTimes[stepKey] ??= now;

  ctx.incrementRetry = () => {
    watcher.retries[stepKey] = Math.min((watcher.retries[stepKey] || 0) + 1, 5);
  };

  // 👉 обработка выбора пользователя
  if (watcher.waitingForChoice && ctx.message) {
    const result = await handleUserChoice(ctx, watcher, stepIndex, now);
    if (result === true) {
      return next(); // продолжить шаг
    } else if (result === null) {
      return; // сцена перезапущена, ничего не делаем
    }
    return; // дожидаемся корректного выбора
  }

  // 👉 проверка зависания
  if (shouldOfferReset(watcher, stepKey, now) && !watcher.waitingForChoice) {
    logStep(ctx, `🔴 Завис на шаге ${stepIndex}`);
    ctx.reply(
      'Кажется, у вас возникли трудности. Хотите начать заново?',
      Markup.keyboard([['🔄 Начать заново', 'Продолжить ▶️']])
        .resize()
        .oneTime()
    );
    watcher.waitingForChoice = true;
    watcher.stuckStep = stepIndex;
    return;
  }

  return next();
}

module.exports = { stuckWatcherMiddleware };
