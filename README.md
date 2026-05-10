# Sub2API Key Stats

一个独立的 Sub2API API Key 使用统计页。用户只需要输入自己的 `sk-...` Key，就能查看这个 Key 的请求次数、模型分布、接口分布、图片请求和最近调用记录。

这个项目不改动 `Wei-Shaw/sub2api` 源码，也不要求用户登录 Sub2API 后台。

## 不展示的信息

- 不展示 Token。
- 不展示费用。
- 不展示总 Token。
- 不展示总耗时或单次耗时。
- 不展示原 Sub2API 后台域名。

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

打开 `http://localhost:3000`。

## 数据库只读账号

建议在 Sub2API PostgreSQL 中创建专用只读账号，不要使用 Sub2API 的 owner 账号。

```sql
CREATE ROLE key_stats_reader LOGIN PASSWORD 'replace-with-a-strong-password';
GRANT CONNECT ON DATABASE sub2api TO key_stats_reader;
GRANT USAGE ON SCHEMA public TO key_stats_reader;

GRANT SELECT (
  id,
  user_id,
  key,
  name,
  status,
  created_at,
  deleted_at,
  expires_at,
  last_used_at
) ON public.api_keys TO key_stats_reader;

GRANT SELECT (
  api_key_id,
  model,
  requested_model,
  created_at,
  inbound_endpoint,
  stream,
  image_count,
  image_size,
  service_tier
) ON public.usage_logs TO key_stats_reader;
```

然后把 `.env` 中的 `DATABASE_URL` 改成这个账号。

## Coolify 部署

1. 在 GitHub 创建私有仓库 `771452430/sub2api-key-stats`。
2. 把本项目推送到该仓库。
3. 在 Coolify 新建应用，来源选择这个私有仓库。
4. 设置环境变量，至少包含：

```bash
NEXT_PUBLIC_PUBLIC_BASE_URL=https://key.xiaokoudai.cc
DATABASE_URL=postgresql://key_stats_reader:password@sub2api-postgres:5432/sub2api
DATABASE_SSL=false
SUB2API_UPSTREAM_URL=http://sub2api:8080
USAGE_LOOKUP_RATE_LIMIT=30
USAGE_LOOKUP_WINDOW_SECONDS=60
```

5. 让容器加入 `sub2api_sub2api-network` 网络，这样可以访问 `sub2api-postgres:5432`。
6. 绑定域名 `key.xiaokoudai.cc` 并开启 HTTPS。

## 验证

```bash
npm run typecheck
npm run build
```

部署后检查：

- 有效 Key 只返回该 Key 的统计。
- 无效、停用、删除、过期 Key 返回统一错误。
- 页面和接口响应中没有 Token、费用、总 Token、耗时字段。

## 同域 API 代理

为了让用户只看到 `key.xiaokoudai.cc`，应用内置了以下转发：

- `https://key.xiaokoudai.cc/v1/*` -> `SUB2API_UPSTREAM_URL/v1/*`
- `https://key.xiaokoudai.cc/responses` -> `SUB2API_UPSTREAM_URL/responses`
- `https://key.xiaokoudai.cc/responses/*` -> `SUB2API_UPSTREAM_URL/responses/*`

这样用户的客户端可以把 Base URL 配成 `https://key.xiaokoudai.cc`。
