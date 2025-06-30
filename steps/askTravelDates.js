module.exports = async(ctx) => {
    if (ctx.message.text && !ctx.wizard.state.destinationAsked) {
        ctx.wizard.state.destination = ctx.message.text;
        ctx.wizard.state.destinationAsked = true;
    }

    await ctx.reply(
        'Когда вы планируете отправиться в путешествие? 📅 (например, 15 июля)'
    );
    return ctx.wizard.next();
};