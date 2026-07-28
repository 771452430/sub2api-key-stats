# Sub2API Key Stats

一个独立的 Sub2API API Key 使用统计页。用户只需要输入 `usage_...` 查询秘钥，就能查看绑定 Key 的请求次数、模型分布、接口分布、5h / 24h / 7d 额度占比和最近调用记录。

这个项目不改动 `Wei-Shaw/sub2api` 源码，也不要求用户登录 Sub2API 后台。
查询秘钥只用于查看统计，不能调用模型。真实 `sk-...` API Key 只在管理员生成查询秘钥时通过后端接口提交一次，不会出现在公开查询页面。

## 不展示的信息

- 不展示消费金额或费用明细。
- 不展示 Token。
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

如果本地开发时出现 `.next` chunk 缓存错误，可以用干净模式重启：

```bash
npm run dev:clean
```

生产预览建议使用 standalone 启动方式：

```bash
npm run build
PORT=3100 HOSTNAME=127.0.0.1 npm start
```

打开 `http://127.0.0.1:3100`。

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
  last_used_at,
  rate_limit_5h,
  usage_5h,
  rate_limit_1d,
  usage_1d,
  rate_limit_7d,
  usage_7d,
  window_5h_start,
  window_1d_start,
  window_7d_start
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

然后把 `.env` 中的 `SUB2API_DATABASE_URL` 改成这个账号。

如果已有 `key_stats_reader` 只缺少周额度字段权限，可以在线补充，不需要停 Sub2API：

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';

GRANT SELECT (
  rate_limit_7d,
  usage_7d,
  window_7d_start
) ON public.api_keys TO key_stats_reader;

COMMIT;
```

## 查询秘钥应用库

查询秘钥映射存放在 key-stats 自己的 PostgreSQL，不写入 Sub2API 数据库。

```bash
APP_DATABASE_URL=postgresql://key_stats_app:password@key-stats-postgres:5432/key_stats
APP_DATABASE_SSL=false
LOOKUP_TOKEN_PEPPER=replace-with-a-long-random-hmac-secret
LOOKUP_ADMIN_TOKEN=replace-with-a-long-random-admin-token
```

首次生成或查询秘钥时，会在 `APP_DATABASE_URL` 对应库中自动创建 `usage_lookup_tokens` 表。表里只存查询秘钥哈希、`api_key_id`、脱敏 Key 和状态时间字段，不存真实 API Key，也不存查询秘钥明文。

管理员生成查询秘钥：

```bash
curl -X POST https://key.xiaokoudai.cc/api/admin/lookup-tokens \
  -H "Authorization: Bearer $LOOKUP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"sk-真实key","label":"张三"}'
```

返回的 `lookupSecret` 只展示一次。重新为同一个 API Key 生成时，旧查询秘钥会自动吊销。

## Coolify 部署

1. 在 GitHub 创建私有仓库 `771452430/sub2api-key-stats`。
2. 把本项目推送到该仓库。
3. 在 Coolify 新建应用，来源选择这个私有仓库。
4. 设置环境变量，至少包含：

```bash
SUB2API_DATABASE_URL=postgresql://key_stats_reader:password@sub2api-postgres:5432/sub2api
DATABASE_SSL=false
APP_DATABASE_URL=postgresql://key_stats_app:password@key-stats-postgres:5432/key_stats
APP_DATABASE_SSL=false
LOOKUP_TOKEN_PEPPER=replace-with-a-long-random-hmac-secret
LOOKUP_ADMIN_TOKEN=replace-with-a-long-random-admin-token
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

- 有效查询秘钥只返回绑定 Key 的统计。
- 无效、吊销、过期查询秘钥返回统一错误。
- 无效、停用、删除、过期 Key 无法生成查询秘钥。
- 周额度展示 `rate_limit_7d`、`usage_7d`、`window_7d_start`。
- 页面和接口响应中没有 Token、费用、总 Token、耗时字段。
