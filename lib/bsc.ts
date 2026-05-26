/**
 * BNB Smart Chain (BSC) / BEP20 USDT 工具
 * - 扫描充值（使用 BscScan API 拉取某地址的 BEP20 转账）
 * - 发送提现（热钱包签名转账）
 */
import { ethers } from 'ethers';

export function getBscConfig() {
  return {
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
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

/** 通过全节点直接拉取指定区块内的 BEP20 USDT 充值记录 */
export async function fetchBep20Transfers(
  toAddress: string,
  blockNumber: number
) {
  const cfg = getBscConfig();
  const provider = getProvider();

  // 连带拉取该区块内所有的交易详情
  const block = await provider.getBlock(blockNumber, true);
  if (!block || !block.prefetchedTransactions) return [];

  const results = [];
  const TRANSFER_SIG = '0xa9059cbb'; // transfer(address,uint256)
  const targetContract = cfg.usdtContract.toLowerCase();
  const targetRecipient = toAddress.toLowerCase();

  for (const tx of block.prefetchedTransactions) {
    if (tx.to && tx.to.toLowerCase() === targetContract) {
      if (tx.data.startsWith(TRANSFER_SIG) && tx.data.length >= 138) {
        // data 结构: 0xa9059cbb (4 bytes) + to (32 bytes) + value (32 bytes)
        const decodedTo = '0x' + tx.data.substring(34, 74);
        
        if (decodedTo.toLowerCase() === targetRecipient) {
          // 只命中极少数交易，所以这里拉取 receipt 确认是否执行成功不会造成性能负担
          const receipt = await provider.getTransactionReceipt(tx.hash);
          if (receipt && receipt.status === 1) {
            const amountHex = '0x' + tx.data.substring(74);
            const amountUsdt = ethers.formatUnits(amountHex, 18);
            
            results.push({
              txHash: tx.hash,
              from: tx.from,
              to: toAddress,
              amountUsdt,
              blockTimestamp: block.timestamp * 1000,
              blockNumber: block.number,
              tokenSymbol: 'USDT',
              rawData: { hash: tx.hash, data: tx.data },
            });
          }
        }
      }
    }
  }

  return results;
}

/** 使用 getLogs 批量拉取指定区块范围内的 BEP20 USDT 充值记录 */
export async function fetchBep20TransfersBatch(
  toAddress: string,
  fromBlock: number,
  toBlock: number
) {
  const cfg = getBscConfig();
  const provider = getProvider();

  const transferTopic = ethers.id('Transfer(address,address,uint256)');
  const recipientTopic = ethers.zeroPadValue(toAddress.toLowerCase(), 32);

  const filter = {
    address: cfg.usdtContract,
    topics: [transferTopic, null, recipientTopic],
    fromBlock: ethers.toBeHex(fromBlock),
    toBlock: ethers.toBeHex(toBlock),
  };

  const logs = await provider.getLogs(filter);
  const results = [];

  for (const log of logs) {
    // 解析 from 地址：从 topic[1] 获取并去除零填充
    const fromAddress = ethers.getAddress('0x' + log.topics[1].substring(26));
    const amountHex = log.data;
    // USDT BEP20 精度是 18 位（BSC主网）
    const amountUsdt = ethers.formatUnits(amountHex, 18);

    results.push({
      txHash: log.transactionHash,
      from: fromAddress,
      to: toAddress,
      amountUsdt,
      blockNumber: Number(log.blockNumber),
      tokenSymbol: 'USDT',
      rawData: { hash: log.transactionHash, topics: log.topics, data: log.data },
    });
  }

  return results;
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
