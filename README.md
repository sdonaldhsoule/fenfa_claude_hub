# CCH Distributor

基于 [Claude Code Hub](https://github.com/anthropics/claude-code-hub) 的 API Key 分发平台，通过 LinuxDO OAuth 登录自动分配和管理密钥。

## 功能

- **LinuxDO OAuth 登录** — 信任等级 >= 1 的用户自动获取 API Key
- **密钥自动管理** — 不活跃用户自动停用密钥，每日定时统一恢复
- **管理后台** — 用户管理、会话监控、策略配置
- **安全存储** — API Key 使用 AES-256-GCM 加密存储

## 前置要求

- Node.js 20+
- PostgreSQL 16+
- 运行中的 [Claude Code Hub](https://github.com/anthropics/claude-code-hub) 实例
- LinuxDO OAuth 应用（在 [connect.linux.do](https://connect.linux.do) 创建）

## 快速开始

### 1. 克隆项目

```bash
git clone <repo-url>
cd fenfa
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写以下配置：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `NEXT_PUBLIC_SITE_URL` | 本站部署地址，如 `https://your-domain.com` |
| `LINUXDO_CLIENT_ID` | LinuxDO OAuth Client ID |
| `LINUXDO_CLIENT_SECRET` | LinuxDO OAuth Client Secret |
| `CCH_API_URL` | Claude Code Hub 实例地址 |
| `CCH_ADMIN_TOKEN` | CCH 管理员令牌（可登录 CCH 后台的密钥） |
| `JWT_SECRET` | JWT 签名密钥（32+ 字符随机字符串） |
| `ENCRYPTION_KEY` | API Key 加密密钥（任意随机字符串） |
| `INITIAL_ADMIN_LINUXDO_ID` | 首个管理员的 LinuxDO 用户 ID |

> LinuxDO OAuth 回调地址设为 `{NEXT_PUBLIC_SITE_URL}/api/auth/callback`

### 3. 初始化数据库

```bash
npx prisma db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`

## Docker 部署

```bash
docker build -t cch-distributor .

docker run -d \
  --name cch-distributor \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/cch_distributor" \
  -e NEXT_PUBLIC_SITE_URL="https://your-domain.com" \
  -e LINUXDO_CLIENT_ID="..." \
  -e LINUXDO_CLIENT_SECRET="..." \
  -e CCH_API_URL="https://your-cch-instance.com" \
  -e CCH_ADMIN_TOKEN="..." \
  -e JWT_SECRET="..." \
  -e ENCRYPTION_KEY="..." \
  -e INITIAL_ADMIN_LINUXDO_ID="..." \
  cch-distributor
```

容器启动时会自动执行 `prisma db push` 同步数据库 schema。

## Zeabur 部署

项目已包含 `zeabur.json` 配置，可直接通过 Zeabur 平台部署，选择 Docker 构建类型，并在环境变量中填写上述配置。

## 技术栈

- **框架**: Next.js 16 (App Router, Standalone)
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: LinuxDO OAuth + JWT (jose)
- **加密**: AES-256-GCM (Node.js crypto)
- **UI**: Tailwind CSS 4 + shadcn/ui + Radix UI
- **语言**: TypeScript 5

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 登录页
│   ├── dashboard/            # 用户仪表盘
│   ├── admin/                # 管理后台
│   └── api/
│       ├── auth/             # 登录/回调/登出/用户信息
│       ├── user/key/         # 用户密钥查询
│       ├── admin/            # 管理员 API
│       └── health/           # 健康检查
├── lib/
│   ├── auth.ts               # JWT + AES 加密
│   ├── cch-client.ts         # CCH API 客户端
│   ├── key-policy.ts         # 密钥自动停用/恢复策略
│   ├── oauth.ts              # LinuxDO OAuth
│   └── prisma.ts             # Prisma 客户端
└── components/ui/            # shadcn/ui 组件
```

## License

MIT
