const MAX_RETRIES = 3;
const TIMEOUT_MS = 120000; // 2 минуты

function initWatcher(session) {
  if (!session.stuckWatcher) {
    session.stuckWatcher = {
      retries: {},
      lastStepTimes: {},
      waitingForChoice: false,
      stuckStep: null,
    };
  }
  return session.stuckWatcher;
}

function resetWatcher(session) {
  session.stuckWatcher = {
    retries: {},
    lastStepTimes: {},
    waitingForChoice: false,
    stuckStep: null,
  };
}

function shouldOfferReset(watcher, stepKey, now) {
  const isStuckByTimeout = now - watcher.lastStepTimes[stepKey] > TIMEOUT_MS;
  const isStuckByRetries = watcher.retries[stepKey] >= MAX_RETRIES;
  return isStuckByTimeout || isStuckByRetries;
}

async function handleUserChoice(ctx, watcher, stepIndex, now) {
  const answer = ctx.message?.text;
  if (!answer) return false;

  if (answer === 'Продолжить ▶️') {
    watcher.waitingForChoice = false;
    watcher.retries[`step_${stepIndex}`] = 0;
    watcher.lastStepTimes[`step_${stepIndex}`] = now;
    return true; // идём дальше
  }

  if (answer === '🔄 Начать заново' || answer === '/reset') {
    resetWatcher(ctx.session);
    await ctx.scene.leave();
    await ctx.scene.enter('TOUR_QUESTIONNAIRE');
    return null; // прерываем
  }

  return false; // ждём корректный ввод
}

module.exports = {
  initWatcher,
  resetWatcher,
  shouldOfferReset,
  handleUserChoice,
};
