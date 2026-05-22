/**
 * BNB Smart Chain (BSC) / BEP20 USDT 工具
 * - 扫描充值（使用 BscScan API 拉取某地址的 BEP20 转账）
 * - 发送提现（热钱包签名转账）
 */
import { ethers } from 'ethers';

export function getBscConfig() {
  return {
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
    bscScanApiKey: process.env.BSCSCAN_API_KEY || '',
    usdtContract: process.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
    hotWallet: process.env.HOT_WALLET_ADDRESS || '',
    hotWalletPk: process.env.HOT_WALLET_PRIVATE_KEY || '',
  };
}

export function getProvider() {
  const cfg = getBscConfig();
  return new ethers.JsonRpcProvider(cfg.rpcUrl);
}

/** 校验 EVM 地址 */
export async function isValidBscAddress(addr: string): Promise<boolean> {
  if (!addr) return false;
  return ethers.isAddress(addr);
}

/** 通过 BscScan API 拉取某地址的 BEP20 USDT 转入记录 */
export async function fetchBep20Transfers(
  toAddress: string,
  options: { minBlockNumber?: number } = {}
) {
  const cfg = getBscConfig();
  if (!cfg.bscScanApiKey) {
    throw new Error('BSCSCAN_API_KEY 未配置');
  }

  const params = new URLSearchParams({
    module: 'account',
    action: 'tokentx',
    contractaddress: cfg.usdtContract,
    address: toAddress,
    page: '1',
    offset: '100',
    sort: 'asc',
    apikey: cfg.bscScanApiKey,
  });

  if (options.minBlockNumber) {
    params.set('startblock', String(options.minBlockNumber));
  }

  const url = `https://api.bscscan.com/api?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`BscScan HTTP Error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  
  if (json.status !== '1' && json.message !== 'No transactions found') {
    throw new Error(`BscScan API 错误: ${json.message} - ${json.result}`);
  }

  const txs = json.result;
  if (!Array.isArray(txs)) return [];

  // 过滤出只有转入到 toAddress 的记录
  const incoming = txs.filter((tx: any) => tx.to.toLowerCase() === toAddress.toLowerCase());

  return incoming.map((tx: any) => ({
    txHash: tx.hash,
    from: tx.from,
    to: tx.to,
    // BscScan 的 BEP20 USDT 精度是 18 位，可以使用我们原本为 TRON 的 sunToUsdt 工具，
    // 但是等等！USDT 在 BSC 上的精度是 18 位 (1 USDT = 10^18 wei)。而在 TRON 上是 6 位 (10^6 sun)。
    // 这里如果直接用 `sunToUsdt` (假设它写死了 / 1e6) 就会有问题。
    // 我们用 ethers.formatUnits(tx.value, 18) 会更精确。
    amountUsdt: ethers.formatUnits(tx.value, 18),
    blockTimestamp: Number(tx.timeStamp) * 1000,
    blockNumber: Number(tx.blockNumber),
    tokenSymbol: tx.tokenSymbol,
    rawData: tx,
  }));
}

/** 发送 BEP20 USDT 提现（热钱包签名） */
export async function sendBep20(
  toAddress: string,
  amountUsdt: string
): Promise<{ txHash: string }> {
  const cfg = getBscConfig();
  if (!cfg.hotWallet || !cfg.hotWalletPk) {
    throw new Error('热钱包未配置（HOT_WALLET_ADDRESS / HOT_WALLET_PRIVATE_KEY）');
  }

  const provider = getProvider();
  const wallet = new ethers.Wallet(cfg.hotWalletPk, provider);

  const abi = [
    "function transfer(address to, uint256 amount) returns (boolean)"
  ];
  const contract = new ethers.Contract(cfg.usdtContract, abi, wallet);

  // USDT BEP20 精度是 18 位
  const amountWei = ethers.parseUnits(amountUsdt, 18);

  const tx = await contract.transfer(toAddress, amountWei);
  return { txHash: tx.hash };
}

/** 查询当前区块号 */
export async function getCurrentBlock(): Promise<number> {
  const provider = getProvider();
  return await provider.getBlockNumber();
}
