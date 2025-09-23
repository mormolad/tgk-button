const { Markup } = require('telegraf');
const { logStep } = require('../utils/logger');

const MAX_RETRIES = 3;
const TIMEOUT_MS = 120000; // 2 минуты

function withStuckWatcher(steps) {
  return steps.map((step, index) => {
    return async (ctx, next) => {
      // --- Инициализация сессии ---
      if (!ctx.session) ctx.session = {};
      const session = ctx.session;

      if (!session.stuckWatcher) {
        session.stuckWatcher = {
          retries: {},
          lastStepTimes: {},
          waitingForChoice: false,
          stuckStep: null,
        };
      } else {
        if (!session.stuckWatcher.retries) session.stuckWatcher.retries = {};
        if (!session.stuckWatcher.lastStepTimes)
          session.stuckWatcher.lastStepTimes = {};
        if (typeof session.stuckWatcher.waitingForChoice !== 'boolean')
          session.stuckWatcher.waitingForChoice = false;
        if (!('stuckStep' in session.stuckWatcher))
          session.stuckWatcher.stuckStep = null;
      }

      const watcher = session.stuckWatcher;
      const stepKey = `step_${index}`;

      if (watcher.retries[stepKey] == null) watcher.retries[stepKey] = 0;
      if (watcher.lastStepTimes[stepKey] == null)
        watcher.lastStepTimes[stepKey] = Date.now();

      ctx.incrementRetry = () => {
        watcher.retries[stepKey] = Math.min(
          (watcher.retries[stepKey] || 0) + 1,
          5
        );
      };

      try {
        const now = Date.now();
        const lastTime = watcher.lastStepTimes[stepKey];
        const retries = watcher.retries[stepKey];
        // Новая логика показа предложения сброса
        const isStuckByTimeout = now - lastTime > TIMEOUT_MS;
        const isStuckByRetries = retries >= MAX_RETRIES;

        if (
          (isStuckByTimeout || isStuckByRetries) &&
          !watcher.waitingForChoice
        ) {
          logStep(
            ctx,
            `🔴 Пользователь завис на шаге ${index} (${retries} попыток)`
          );

          await ctx.reply(
            'Кажется, у вас возникли трудности. Хотите начать заново?',
            Markup.keyboard([['🔄 Начать заново', 'Продолжить ▶️']])
              .resize()
              .oneTime()
          );

          watcher.waitingForChoice = true;
          watcher.stuckStep = index;
          return;
        }

        if (watcher.waitingForChoice && ctx.message) {
          const answer = ctx.message.text;

          if (answer === 'Продолжить ▶️') {
            watcher.waitingForChoice = false;
            watcher.retries[stepKey] = 0;
            watcher.lastStepTimes[stepKey] = now;
            return step(ctx, next);
          }

          if (answer === '🔄 Начать заново') {
            session.stuckWatcher = {
              retries: {},
              lastStepTimes: {},
              waitingForChoice: false,
              stuckStep: null,
            };
            await ctx.scene.leave();
            return ctx.scene.enter('TOUR_QUESTIONNAIRE');
          }

          return; // ждём корректный ввод
        }

        // --- Выполнение текущего шага ---
        // Предполагаем, что шаг возвращает { success: boolean } или undefined
        const result = await step(ctx, next);

        if (result && result.success === false) {
          ctx.incrementRetry();
        } else {
          // Обнуляем счётчики, если успешный ввод
          watcher.retries[stepKey] = 0;
          watcher.lastStepTimes[stepKey] = now;
        }

        return result;
      } catch (error) {
        logStep(ctx, `❌ Ошибка на шаге ${index}: ${error.message}`);
        ctx.incrementRetry(); // увеличиваем счётчик при ошибке
        throw error;
      }
    };
  });
}

module.exports = { withStuckWatcher };
