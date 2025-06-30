module.exports = async(ctx) => {
    ctx.wizard.state.companions = ctx.message.text;

    if (
        ctx.message.text.includes('детьми') ||
        ctx.message.text.includes('Группа')
    ) {
        await ctx.reply(
            'Сколько будет детей и их возраст? (Например: 1 ребёнок 5 лет, 2 ребёнка 8 и 10 лет)'
        );
        return ctx.wizard.next();
    }

    await ctx.reply(
        'Какой тип отдыха предпочитаете?',
        Markup.keyboard([
            ['Пляжный 🏖️', 'Экскурсионный 🏛️'],
            ['Горнолыжный ⛷️', 'SPA/Оздоровление 💆‍♀️'],
            ['Активный 🚵‍♀️', 'Городской 🏙️'],
        ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.selectStep(11); // пропускаем шаг с детьми
};