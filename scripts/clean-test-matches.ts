/**
 * 清理测试盘口与比赛数据 (clean-test-matches.ts)
 * 作用：
 * - 扫描数据库中包含 "测试" 字样的模拟赛事、测试队 A/B/C、测试超级联赛
 * - 安全、按外键顺序依次清理关联的流水、下注、选项、盘口与比赛
 * - 彻底还原盘口大厅的纯净状态，只保留真实的各大联赛和世界杯预测
 */
import { prisma } from '../lib/db';

async function main() {
  console.log('[clean-test] 开始扫描并安全清理测试赛事数据...');

  // 1. 获取所有含有 "测试" 关键字的比赛
  const testMatches = await prisma.match.findMany({
    where: {
      OR: [
        { competition: { contains: '测试' } },
        { homeTeam: { contains: '测试' } },
        { awayTeam: { contains: '测试' } },
      ],
    },
  });

  if (testMatches.length === 0) {
    console.log('[clean-test] ✓ 未发现任何带有 "测试" 关键字的比赛，无需清理');
    return;
  }

  const matchIds = testMatches.map((m) => m.id);
  console.log(`[clean-test] 发现 ${testMatches.length} 场测试比赛，准备安全清理关联数据...`);

  // 2. 获取关联的市场
  const testMarkets = await prisma.market.findMany({
    where: { matchId: { in: matchIds } },
  });
  const marketIds = testMarkets.map((m) => m.id);

  // 3. 获取关联的下注记录
  const testBets = await prisma.bet.findMany({
    where: { marketId: { in: marketIds } },
  });
  const betIds = testBets.map((b) => b.id);

  await prisma.$transaction(async (tx) => {
    // A. 清理账目流水中的测试下注关联
    if (betIds.length > 0) {
      const deletedTx = await tx.transaction.deleteMany({
        where: { refType: 'BET', refId: { in: betIds } },
      });
      console.log(`[clean-test] ✓ 清理了 ${deletedTx.count} 条测试财务流水`);

      const deletedBets = await tx.bet.deleteMany({
        where: { id: { in: betIds } },
      });
      console.log(`[clean-test] ✓ 清理了 ${deletedBets.count} 条测试下注记录`);
    }

    // B. 清理串关子项
    if (marketIds.length > 0) {
      const deletedParlayItems = await tx.parlayItem.deleteMany({
        where: { marketId: { in: marketIds } },
      });
      console.log(`[clean-test] ✓ 清理了 ${deletedParlayItems.count} 条测试串关记录`);

      // C. 清理选项与市场
      const deletedOptions = await tx.marketOption.deleteMany({
        where: { marketId: { in: marketIds } },
      });
      console.log(`[clean-test] ✓ 清理了 ${deletedOptions.count} 个测试盘口选项`);

      const deletedMarkets = await tx.market.deleteMany({
        where: { id: { in: marketIds } },
      });
      console.log(`[clean-test] ✓ 清理了 ${deletedMarkets.count} 个测试盘口市场`);
    }

    // D. 清理比赛
    const deletedMatches = await tx.match.deleteMany({
      where: { id: { in: matchIds } },
    });
    console.log(`[clean-test] ✓ 清理了 ${deletedMatches.count} 场测试比赛`);
  });

  console.log('[clean-test] 🎉 测试垃圾数据清理完毕，前台大厅已完全净化！');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[clean-test] ❌ 清理失败:', e);
    process.exit(1);
  });
