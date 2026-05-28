/**
 * 定时注水脚本 (inject-water.ts)
 * 作用：
 * - 自动检测并初始化 10 个虚拟机器人用户 (robot_1 到 robot_10)
 * - 定时轮询状态为 OPEN 且尚未截止的预测市场
 * - 如果盘口资金池为 0，立即执行“初始化种子注水”（随机进行 12-20 次投注，使各个盘口都有数据且总彩池有初始规模）
 * - 随机挑选盘口选项并使用机器人余额以真实下注模式下注，从而平滑地“注水”增加池子活跃度
 * - 保证数据库彩池一致性，使得真实结算时用户赔率自然变动且数学上精确一致
 *
 * 用法：
 *   npx tsx scripts/inject-water.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import { add, sub, toStr } from '../lib/money';
import bcrypt from 'bcryptjs';

const BOT_PREFIX = 'robot_';
const BOT_COUNT = Number(process.env.INJECT_BOT_COUNT || 10);
const BOT_INITIAL_BALANCE = '1000000.000000'; // 1,000,000 U

const INJECT_INTERVAL_SECONDS = Number(process.env.INJECT_INTERVAL_SECONDS || 30);
const INJECT_PROBABILITY = Number(process.env.INJECT_PROBABILITY || 0.4); // 40% 概率触发下注
const INJECT_MIN_AMOUNT = Number(process.env.INJECT_MIN_AMOUNT || 5);
const INJECT_MAX_AMOUNT = Number(process.env.INJECT_MAX_AMOUNT || 50);

/** 初始化虚拟机器人用户 */
async function ensureBotsExist() {
  console.log(`[inject] 正在初始化 ${BOT_COUNT} 个机器人用户...`);
  const passwordHash = await bcrypt.hash('botpassword123', 10);

  for (let i = 1; i <= BOT_COUNT; i++) {
    const username = `${BOT_PREFIX}${i}`;
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        passwordHash,
        role: 'USER',
        balanceUsdt: BOT_INITIAL_BALANCE,
      },
    });
  }
  console.log(`[inject] ✓ ${BOT_COUNT} 个机器人用户已准备就绪`);
}

/** 对全新的零资金池盘口进行初始化注资（种子注水） */
async function seedMarketIfNew(market: any) {
  if (Number(market.totalStake) > 0) return;

  console.log(`[inject] 发现全新零资金盘口 "${market.title}"，正在执行初始化种子注水...`);
  
  // 随机生成 12 到 20 笔种子下注，分发到各个不同选项上
  const betCount = Math.floor(Math.random() * 9) + 12; // 12 - 20 笔
  for (let k = 0; k < betCount; k++) {
    // 重新拉取最新的 options 状态
    const latestOptions = await prisma.marketOption.findMany({
      where: { marketId: market.id }
    });
    if (latestOptions.length === 0) continue;

    const targetOption = latestOptions[Math.floor(Math.random() * latestOptions.length)];
    const randomAmount = (Math.random() * (INJECT_MAX_AMOUNT - INJECT_MIN_AMOUNT) + INJECT_MIN_AMOUNT).toFixed(2);
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

      // 重新拉取最新的 option totalStake，防止事务并发覆盖
      const latestOption = await tx.marketOption.findUnique({ where: { id: targetOption.id } });
      if (!latestOption) return;

      const newOptionStake = add(latestOption.totalStake, amountStr);
      await tx.marketOption.update({
        where: { id: latestOption.id },
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
          optionId: latestOption.id,
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
          remark: `[初始化种子注水] 下注 ${market.title} - ${latestOption.label}`,
        },
      });
    });
  }
  console.log(`[inject] ✓ 盘口 "${market.title}" 初始化种子注水完成！`);
}

/** 核心注水步骤 */
async function injectWater() {
  try {
    // 1. 查找所有开放中且未过期的市场
    const now = new Date();
    const openMarkets = await prisma.market.findMany({
      where: {
        status: 'OPEN',
        lockAt: { gt: now },
      },
      include: {
        options: true,
      },
    });

    if (openMarkets.length === 0) {
      return;
    }

    console.log(`[inject] 当前开放市场数: ${openMarkets.length}，进行轮询评估...`);

    for (const market of openMarkets) {
      // 2. 如果是全新零资金盘口，立即执行种子注水
      if (Number(market.totalStake) === 0) {
        await seedMarketIfNew(market);
        continue; // 种子注水完成，本次轮询不再对此盘口重复下注
      }

      // 3. 概率决定普通盘口本次轮询是否下注
      if (Math.random() > INJECT_PROBABILITY) {
        continue;
      }

      // 4. 随机选择一个选项进行投注
      const options = market.options;
      if (options.length === 0) continue;
      const targetOption = options[Math.floor(Math.random() * options.length)];

      // 5. 随机生成下注金额
      const randomAmount = (Math.random() * (INJECT_MAX_AMOUNT - INJECT_MIN_AMOUNT) + INJECT_MIN_AMOUNT).toFixed(2);
      const amountStr = toStr(randomAmount);

      // 6. 随机选择一个机器人
      const botIdx = Math.floor(Math.random() * BOT_COUNT) + 1;
      const botUsername = `${BOT_PREFIX}${botIdx}`;

      // 7. 执行与真实下注完全相同的事务流程，确保分账彩池百分之百对齐
      await prisma.$transaction(async (tx) => {
        const botUser = await tx.user.findUnique({
          where: { username: botUsername },
        });
        if (!botUser) throw new Error(`机器人 ${botUsername} 不存在`);

        // 如果余额不足，自动充值补充
        let currentBalance = botUser.balanceUsdt;
        if (Number(currentBalance) < Number(amountStr)) {
          console.log(`[inject] 机器人 ${botUsername} 余额不足，正在自动注资...`);
          currentBalance = add(currentBalance, BOT_INITIAL_BALANCE);
        }

        const newBalance = sub(currentBalance, amountStr);

        // A. 更新机器人余额
        await tx.user.update({
          where: { id: botUser.id },
          data: { balanceUsdt: newBalance },
        });

        // B. 累加盘口选项资金
        const newOptionStake = add(targetOption.totalStake, amountStr);
        await tx.marketOption.update({
          where: { id: targetOption.id },
          data: {
            totalStake: newOptionStake,
            betCount: { increment: 1 },
          },
        });

        // C. 累加市场总资金
        const newMarketStake = add(market.totalStake, amountStr);
        await tx.market.update({
          where: { id: market.id },
          data: { totalStake: newMarketStake },
        });

        // D. 创建真实的 Bet 关联
        const bet = await tx.bet.create({
          data: {
            userId: botUser.id,
            marketId: market.id,
            optionId: targetOption.id,
            amount: amountStr,
            status: 'ACTIVE',
          },
        });

        // E. 创建真实的财务流水 Transaction
        await tx.transaction.create({
          data: {
            userId: botUser.id,
            type: 'BET_PLACE',
            amount: '-' + amountStr,
            balanceAfter: newBalance,
            refType: 'BET',
            refId: bet.id,
            remark: `[机器人注水] 下注 ${market.title} - ${targetOption.label}`,
          },
        });

        console.log(`[inject] 🤖 ${botUsername} 注入了 ${amountStr} USDT 于盘口 "${market.title}" -> 【${targetOption.label}】`);
      });
    }
  } catch (error: any) {
    console.error(`[inject] 错误:`, error.message || error);
  }
}

/** 主运行函数 */
async function main() {
  await ensureBotsExist();

  console.log(`[inject] 注水守护进程已开启！轮询周期: ${INJECT_INTERVAL_SECONDS}秒, 注入概率: ${(INJECT_PROBABILITY * 100).toFixed(0)}%`);
  
  // 首次运行
  await injectWater();

  // 定时循环
  setInterval(async () => {
    await injectWater();
  }, INJECT_INTERVAL_SECONDS * 1000);
}

main().catch((err) => {
  console.error('[inject] 发生致命错误:', err);
  process.exit(1);
});
