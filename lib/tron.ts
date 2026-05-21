/**
 * Tron / TRC20 USDT 工具
 * - 扫描充值（从 TronGrid 拉某地址的 TRC20 转账）
 * - 发送提现（热钱包签名转账）
 *
 * 注：tronweb 仅在 server 端 import，前端不要直接使用
 */
import { sunToUsdt, usdtToSun } from './money';

// 延迟加载，避免 Next 客户端打包失败
let TronWebMod: any = null;
async function loadTronWeb() {
  if (!TronWebMod) {
    // @ts-ignore
    const mod: any = await import('tronweb');
    TronWebMod = mod.default || mod.TronWeb || mod;
  }
  return TronWebMod;
}

export function getTronConfig() {
  return {
    fullHost: process.env.TRON_FULL_NODE || 'https://api.shasta.trongrid.io',
    apiKey: process.env.TRON_API_KEY || '',
    network: process.env.TRON_NETWORK || 'shasta',
    usdtContract:
      process.env.USDT_CONTRACT_ADDRESS ||
      'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs', // Shasta 测试网默认
    hotWallet: process.env.HOT_WALLET_ADDRESS || '',
    hotWalletPk: process.env.HOT_WALLET_PRIVATE_KEY || '',
  };
}

/** 构造 TronWeb 实例 */
export async function getTronWeb(privateKey?: string) {
  const cfg = getTronConfig();
  const TronWeb = await loadTronWeb();
  const headers: Record<string, string> = {};
  if (cfg.apiKey) headers['TRON-PRO-API-KEY'] = cfg.apiKey;

  return new TronWeb({
    fullHost: cfg.fullHost,
    headers,
    privateKey: privateKey || cfg.hotWalletPk || undefined,
  });
}

/** 校验 Tron 地址 */
export async function isValidTronAddress(addr: string): Promise<boolean> {
  if (!addr) return false;
  try {
    const TronWeb = await loadTronWeb();
    return TronWeb.isAddress(addr);
  } catch {
    return false;
  }
}

/** 通过 TronGrid HTTP API 拉某地址的 TRC20 USDT 转入记录 */
export async function fetchTrc20Transfers(
  toAddress: string,
  options: { onlyConfirmed?: boolean; limit?: number; minTimestampMs?: number } = {}
) {
  const cfg = getTronConfig();
  const params = new URLSearchParams({
    contract_address: cfg.usdtContract,
    only_confirmed: String(options.onlyConfirmed ?? true),
    only_to: 'true',
    limit: String(options.limit ?? 50),
    order_by: 'block_timestamp,asc',
  });
  if (options.minTimestampMs) {
    params.set('min_timestamp', String(options.minTimestampMs));
  }

  const url = `${cfg.fullHost}/v1/accounts/${toAddress}/transactions/trc20?${params.toString()}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cfg.apiKey) headers['TRON-PRO-API-KEY'] = cfg.apiKey;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`TronGrid ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: any[]; success?: boolean };
  if (!json.data) return [];
  return json.data.map((tx) => ({
    txHash: tx.transaction_id as string,
    from: tx.from as string,
    to: tx.to as string,
    amountUsdt: sunToUsdt(tx.value),
    blockTimestamp: Number(tx.block_timestamp) as number,
    tokenSymbol: tx.token_info?.symbol as string | undefined,
    rawData: tx,
  }));
}

/** 发送 TRC20 USDT 提现（热钱包签名） */
export async function sendTrc20(
  toAddress: string,
  amountUsdt: string
): Promise<{ txHash: string }> {
  const cfg = getTronConfig();
  if (!cfg.hotWallet || !cfg.hotWalletPk) {
    throw new Error('热钱包未配置（HOT_WALLET_ADDRESS / HOT_WALLET_PRIVATE_KEY）');
  }
  const tronWeb = await getTronWeb(cfg.hotWalletPk);
  tronWeb.setAddress(cfg.hotWallet);

  const contract = await tronWeb.contract().at(cfg.usdtContract);
  const sun = usdtToSun(amountUsdt);
  const txId: string = await contract.transfer(toAddress, sun.toString()).send({
    feeLimit: 100_000_000, // 100 TRX upper bound for energy fees
    callValue: 0,
  });
  return { txHash: txId };
}

/** 查询当前区块号 */
export async function getCurrentBlock(): Promise<number> {
  const tronWeb = await getTronWeb();
  const block = await tronWeb.trx.getCurrentBlock();
  return block?.block_header?.raw_data?.number || 0;
}
