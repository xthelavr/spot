const models = require('../models');
const Components = require('./components');
const message = require('./message');
const Markup = require('telegraf/markup');

const spots = {};

module.exports = (bot) => {
  bot.hears(/start@SpotBBot (.+)/, async (ctx) => {
    if (ctx.chat.type === 'group') {
      const {match} = ctx;
      const hash = match[1];
      const spot = await models.Spot.getByHash(hash);
      if (spot) {
        await models.Spot.addGroup(hash, ctx.chat.id, ctx.chat.title);
        ctx.reply(message.NEW_SPOT_IS_CREATED)
          .then(() => Components.sendMatch(ctx, spot));
      }
    }
  });

  bot.on('contact', async (ctx) => {
    const {from} = ctx;
    Components.mainKeyboard(ctx);
    if (ctx.message.contact) {
      const phone = ctx.message.contact.phone_number;
      if (spots[from.id]) {
        const {groupId} = spots[from.id];
        await bot.telegram.sendMessage(
          groupId,
          message.NEW_PLAYER_WANTS_TO_ADD,
          {parse_mode: 'Markdown'}
        );
        await bot.telegram.sendContact(groupId, phone, `${from.first_name} ${from.last_name}`);
      }
    }
  });

  bot.command(`/next@SpotBBot`, async (ctx) => {
    const groupId = ctx.update.message.chat.id;
    const spot = await models.Spot.getSpotByGroupId(groupId);
    Components.sendMatch(ctx, spot);
  });

  bot.command(`/members@SpotBBot`, async (ctx) => {
    const groupId = ctx.update.message.chat.id;
    const spot = await models.Spot.getSpotByGroupId(groupId);
    Components.sendPlayers(ctx, spot.players);
  });

  bot.command('/remove@SpotBBot', async (ctx) => {
    const groupId = ctx.update.message.chat.id;
    const spot = await models.Spot.getSpotByGroupId(groupId);
    const admins = await ctx.getChatAdministrators();
    if (!admins.find((admin) => admin.user.id === ctx.from.id)) {
      return ctx.replyWithMarkdown(message.YOU_ARE_NOT_ADMIN(ctx.from.first_name));
    }
    if (spot) {
      await models.Spot.removeSpot(spot.hash);
      ctx.replyWithMarkdown(message.CURRENT_SPOT_HAS_BEEN_REMOVED);
    } else {
      ctx.replyWithMarkdown(message.GROUP_DONT_HAVE_ACTIVE_SPOT);
    }
  });

  bot.action(/add (.+)/, async (ctx) => {
    if (ctx.chat.type === 'group') {
      const {match, from} = ctx;
      const groupId = ctx.chat.id;
      const hash = match[1];
      const spot = await models.Spot.addPlayer(hash, from);
      if (spot) {
        let str = '';
        str += `${message.PLAYER_INFO(from)} пойдет на матч.\n`;
        str += `👍 ${spot.players.length + 1} / ${spot.count}`;
        bot.telegram.sendMessage(groupId, str);
      }
    }
    if (ctx.chat.type === 'private') {
      const {match, from} = ctx;
      const hash = match[1];
      const currentSpot = await models.Spot.getCurrentSpot(from.id);
      spots[from.id] = await models.Spot.getByHash(hash);
      if (!currentSpot) {
        return ctx.replyWithMarkdown(
          'Чтобы добавить вас в матч, необходимо отправить ваш телефонный номер создателю матча.\n' +
          'Нажмите на кнопку *"Отправить контакт"*, если согласны.',
          Markup.keyboard([
            Markup.contactRequestButton('Отправить контакт')
          ]).resize().extra()
        );
      } else {
        ctx.reply(message.SPOT_ALREADY_ACTIVE);
        await Components.sendMatch(ctx, currentSpot);
      }
    }
  });
};
