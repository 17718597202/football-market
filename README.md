# 足彩预测平台（内部 MVP）

公司内部用的足球预测市场，USDT (TRC20) 充值/提现 + 彩池模式自动结算 + football-data.org 拉赛程。Next.js 14 全栈 + Prisma + TronWeb。

> ⚠️ **法律提示**：本项目仅为技术学习/团队内部娱乐用途，组织他人参与赌博在多数司法辖区违法。生产部署前请咨询本地法律意见，并务必将平台抽水设为 0、限制小额、不对外宣传。

---

## 功能一览

**用户侧**
- 用户名 + 密码注册登录
- 浏览市场（进行中 / 已锁定 / 已结算）
- 下注（彩池模式，赔率随池子动态变化）
- 钱包：绑定 TRC20 来源地址、充值、提现申请
- 我的下注、盈亏统计

**管理后台**
- 仪表盘 + 用户管理
- 手动创建市场 / 一键同步 football-data.org 赛程并自动建胜平负市场
- 市场结算（自动 cron + 手动 fallback）/ 作废退款
- 提现审核（批准后热钱包自动签名转账）

**后台 worker**
- TRC20 USDT 充值扫块器（按 fromAddress 匹配用户）
- 自动结算 cron（比赛结束 90 分钟后拉比分）

---

## 快速开始

### 1. 安装依赖

```bash
cd yuce-market
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

打开 `.env` 至少改这几项：

- `JWT_SECRET` 改成随机长字符串（`openssl rand -hex 32`）
- `FOOTBALL_DATA_API_KEY` —— 到 https://www.football-data.org/client/register 免费注册
- `TRON_API_KEY` —— 到 https://www.trongrid.io/ 免费注册（免费档 10 万次/天）
- `HOT_WALLET_ADDRESS` / `HOT_WALLET_PRIVATE_KEY` —— 平台收款热钱包（**强烈建议先在 Shasta 测试网跑通**）

测试网默认配置已经填好（`TRON_NETWORK=shasta`，USDT 合约 `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs`）。
测试网领取免费 TRX：https://shasta.tronex.io/ ，免费 USDT：https://shasta.tronex.io/

### 3. 初始化数据库

```bash
npm run db:push        # 根据 schema.prisma 同步表结构（SQLite 自动创建 dev.db）
npm run db:seed        # 创建管理员账号 + 3 个测试用户 + 2 个示例市场
```

种子完成后会看到：
- `admin / admin123456`（管理员）
- `alice / bob / carol`，密码均为 `test123456`，每人 1000 U 初始余额

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

### 5. 启动后台 worker（可选）

新开一个终端：

```bash
npm run worker         # 一体化：同时跑充值扫描 + 自动结算
# 或分开跑：
# npm run scan:deposits
# npm run settle:cron -- --loop
```

---

## 项目结构

```
yuce-market/
├── app/                      # Next.js 14 App Router
│   ├── api/                  # 后端 API 路由
│   │   ├── auth/             # 注册/登录/登出/me
│   │   ├── markets/          # 市场列表/详情
│   │   ├── bets/             # 下注/我的下注
│   │   ├── wallet/           # 钱包/绑定地址/提现
│   │   └── admin/            # 管理后台 API
│   ├── login/                # 登录页
│   ├── register/             # 注册页
│   ├── markets/[id]/         # 市场详情 + 下注面板
│   ├── wallet/               # 钱包
│   ├── me/bets/              # 我的下注
│   └── admin/                # 管理后台
├── lib/                      # 核心工具层
│   ├── db.ts                 # Prisma client
│   ├── auth.ts               # JWT + bcrypt
│   ├── money.ts              # USDT 精度安全计算
│   ├── tron.ts               # TRC20 USDT 收发
│   ├── football-data.ts      # 数据源客户端
│   ├── pari-mutuel.ts        # 彩池结算算法
│   └── api.ts                # API 响应工具
├── prisma/
│   ├── schema.prisma         # 数据库定义
│   └── seed.ts               # 种子数据
├── scripts/
│   ├── scan-deposits.ts      # TRC20 充值扫块
│   ├── sync-matches.ts       # 同步赛程
│   ├── settle-cron.ts        # 自动结算
│   └── worker.ts             # 一体化 worker
├── .env.example              # 环境变量模板
└── package.json
```

---

## 核心机制

### 彩池模式（Pari-mutuel）结算

平台不做对赌，没有庄家风险。

- 用户押注 → 钱进对应「选项池」
- 比赛结束后选定胜出选项
- 平台抽 `rakeBps / 10000`（如 3%）
- 剩余资金按用户在胜方池的占比瓜分（含本金）

**举例**：胜平负市场，3 人押注：
- A 押「主胜」100 U
- B 押「主胜」200 U
- C 押「平局」150 U

总池 450 U。比赛结果主胜。
- 平台抽 3% = 13.5 U
- 派彩池 = 436.5 U
- 胜方池（A+B）= 300 U
- A 拿回 `436.5 × (100/300) = 145.5 U`（赚 45.5）
- B 拿回 `436.5 × (200/300) = 291 U`（赚 91）
- C 拿 0

如果胜方无人押注 → 全员退款。

### TRC20 USDT 充提流程

**充值**：
1. 用户在钱包页绑定自己的 TRC20 转出地址
2. 用户从该地址转 USDT 到平台收款地址（`HOT_WALLET_ADDRESS`）
3. `scan-deposits` worker 每 30 秒扫一次，通过 `from === user.tronAddress` 自动匹配并入账
4. 未匹配的转入会被记录为 `UNMATCHED`，管理员可在数据库手动处理

**提现**：
1. 用户提交申请 → 余额扣除并冻结
2. 管理员后台审核
3. 批准 → 后端用热钱包私钥签名 TRC20 transfer → 链上发送
4. 驳回 → 资金退回用户余额

### 自动结算流程

1. `settle-cron` 每 5 分钟扫一次：找出所有「比赛已开赛超过 90 分钟、市场仍未结算」的候选
2. 调 football-data.org 拉最终比分
3. 状态为 FINISHED 且能判定胜方 → 调用 `settleMarket()` 自动结算
4. 状态异常 / 数据不一致 → 留给管理员人工结算

---

## 测试网完整跑通流程（推荐先做这个）

1. 注册 trongrid.io，复制 API Key 填入 `TRON_API_KEY`
2. 安装 TronLink 钱包（浏览器扩展），切到 Shasta 测试网，创建账号
3. 到 https://shasta.tronex.io/ 领取 5000 测试 TRX 和测试 USDT
4. 复制 TronLink 地址 → 填入 `.env` 的 `HOT_WALLET_ADDRESS`
5. 导出私钥 → 填入 `HOT_WALLET_PRIVATE_KEY`（注意安全）
6. `npm run db:push && npm run db:seed && npm run dev`
7. 注册一个用户，去 /wallet 绑定你的另一个 TronLink 测试地址
8. 用 TronLink 从那个地址转 1 USDT 到 `HOT_WALLET_ADDRESS`
9. `npm run scan:deposits`，等 30 秒看是否自动入账
10. 在测试市场下个注 → 管理员后台手动结算 → 查看奖金是否正确发放
11. 申请提现 → 管理员批准 → 看链上是否成功转账

---

## 生产部署建议

### 数据库切换到 Postgres

修改 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

修改 `.env`：

```
DATABASE_URL="postgresql://user:pass@host:5432/yuce?schema=public"
```

然后：

```bash
npm run db:migrate     # 生成正式 migration
```

### 部署方式

- **Vercel + Supabase/Neon**：前后端部署到 Vercel，DB 用 Supabase/Neon。**worker（scan-deposits / settle-cron）需要单独跑**（Vercel 不支持长连进程）—— 推荐 Fly.io / Railway / 自有 VPS。
- **全自托管**：一台 1c1g 小机 + docker compose（next + worker + postgres）。
- **Nginx 反代** + HTTPS（Let's Encrypt）。

### 安全加固清单

| 项 | 措施 |
|---|---|
| 热钱包私钥 | 用 AWS KMS / GCP Secret Manager，**绝对不要硬编码** |
| 热钱包余额 | 加定时归集：超过阈值自动转冷钱包 |
| 提现限额 | 单日/单笔限额，单次提现 ≥ N U 需要二次审核 |
| JWT 密钥 | 至少 32 字节随机 |
| 数据库 | 加 backup（每日全量 + 每小时增量） |
| 充值地址 | 改为「每人一个 HD 派生地址」（更稳，但需自动归集 sweep） |
| 防刷 | 加 IP/账号限流（Upstash Redis + middleware） |
| Oracle | 双源核验（football-data + API-Football），结果不一致只人工结算 |

---

## 常用命令速查

```bash
npm run dev            # 开发服务器
npm run build && npm run start    # 生产构建
npm run db:push        # 同步 schema（开发用）
npm run db:migrate     # 生成 migration（生产用）
npm run db:studio      # 可视化数据库
npm run db:seed        # 重置种子
npm run worker         # 启动 worker（充值扫描 + 自动结算）
npm run scan:deposits  # 单独跑充值扫描
npm run settle:cron    # 单次自动结算
npm run sync:matches -- PL 2026-05-20 2026-05-27 --auto  # 同步赛程
```

---

## 后续 Roadmap

- [ ] 用户自助充值地址（HD 派生 + 自动归集）
- [ ] 大小球、亚盘、半全场等更多市场类型
- [ ] 实时赔率 WebSocket 推送
- [ ] 用户排行榜与盈利榜
- [ ] 飞书/钉钉机器人通知（开赛提醒、结算播报）
- [ ] 多数据源 Oracle 双源校验
- [ ] 二次审核 + Telegram 机器人审批大额提现
- [ ] 平台代币 / 积分制（合规友好）
