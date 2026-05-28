/**
 * 一次性补全注资脚本 (seed-zero-options.ts)
 * 作用：
 * - 扫描所有开放中的盘口中注水额为 0 的选项，立即以随机机器人身份注入一笔 5 - 25 USDT 的初始资金
 * - 确保界面上所有队伍、比分、胜平负选项都有真实资金和自然变化的赔率，不再出现 0.00 U 或 0% 的尴尬显示
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import { add, sub, toStr } from '../lib/money';

const BOT_PREFIX = 'robot_';
const BOT_COUNT = 10;
const BOT_INITIAL_BALANCE = '1000000.000000';

async function main() {
  console.log('[seed-options] 开始对所有开放盘口的零额选项进行定向注资补全...');

  const openMarkets = await prisma.market.findMany({
    where: {
      status: 'OPEN',
    },
    include: {
      options: true,
    },
  });

  let seededCount = 0;

  for (const market of openMarkets) {
    const zeroOptions = market.options.filter((o) => Number(o.totalStake) === 0);
    if (zeroOptions.length === 0) continue;

    console.log(`[seed-options] 盘口 "${market.title}" 共有 ${zeroOptions.length} 个零额选项，开始补全...`);

    for (const option of zeroOptions) {
      const randomAmount = (Math.random() * 20 + 5).toFixed(2); // 5 - 25 USDT
      const amountStr = toStr(randomAmount);

      const botIdx = Math.floor(Math.random() * BOT_COUNT) + 1;
      const botUsername = `${BOT_PREFIX}${botIdx}`;

      await prisma.$transaction(async (tx) => {
        const botUser = await tx.user.findUnique({ where: { username: botUsername } });
        if (!botUser) return;

        let currentBalance = botUser.balanceUsdt;
        if (Number(currentBalance) < Number(amountStr)) {
          currentBalance = add(currentBalance, BOT_INITIAL_BALANCE);
        }
        const newBalance = sub(currentBalance, amountStr);

        await tx.user.update({
          where: { id: botUser.id },
          data: { balanceUsdt: newBalance },
        });

        const newOptionStake = add(option.totalStake, amountStr);
        await tx.marketOption.update({
          where: { id: option.id },
          data: {
            totalStake: newOptionStake,
            betCount: { increment: 1 },
          },
        });

        const latestMarket = await tx.market.findUnique({ where: { id: market.id } });
        if (!latestMarket) return;
        const newMarketStake = add(latestMarket.totalStake, amountStr);
        await tx.market.update({
          where: { id: market.id },
          data: { totalStake: newMarketStake },
        });

        const bet = await tx.bet.create({
          data: {
            userId: botUser.id,
            marketId: market.id,
            optionId: option.id,
            amount: amountStr,
            status: 'ACTIVE',
          },
        });

        await tx.transaction.create({
          data: {
            userId: botUser.id,
            type: 'BET_PLACE',
            amount: '-' + amountStr,
            balanceAfter: newBalance,
            refType: 'BET',
            refId: bet.id,
            remark: `[定向补注水] 下注 ${market.title} - ${option.label}`,
          },
        });
      });

      seededCount++;
    }
  }

  console.log(`[seed-options] ✓ 定向补全完成！共为 ${seededCount} 个选项成功注入了初始资金 🎉`);
}

main().catch(console.error);
