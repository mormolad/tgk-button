const { Markup } = require('telegraf');

module.exports = async(ctx) => {
    await ctx.reply(
        `Привет, ${
      ctx.from.first_name || 'путешественник'
    }! 👋\nЯ твой персональный помощник по подбору туров. Ответь на несколько вопросов, и я найду идеальный вариант для тебя!`,
        Markup.keyboard([
            ['Начать опрос ▶️']
        ]).resize()
    );
    return ctx.wizard.next();
};