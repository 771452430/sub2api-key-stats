"use client";

import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Image,
  KeyRound,
  Layers3,
  Loader2,
  LockKeyhole,
  RadioTower,
  RefreshCw,
  Search
} from "lucide-react";
import { FormEvent, startTransition, useState } from "react";

import type { UsageLookupResponse, UsageRange } from "@/lib/usage";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: UsageLookupResponse }
  | { status: "error"; message: string };

const publicBaseUrl =
  process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || "https://key.xiaokoudai.cc";

const ranges: Array<{ label: string; value: UsageRange }> = [
  { label: "7 天", value: "7d" },
  { label: "30 天", value: "30d" },
  { label: "90 天", value: "90d" }
];

function formatDateTime(value: string | null) {
  if (!value) {
    return "暂无";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "暂无";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function maxOf(values: number[]) {
  return Math.max(...values, 1);
}

function StatCard({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "green" | "coral" | "blue" | "gold";
}) {
  return (
    <section className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon">{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
    </section>
  );
}

function EmptyPanel() {
  return (
    <section className="empty-panel">
      <LockKeyhole aria-hidden="true" />
      <h2>输入 API Key 后查看使用记录</h2>
      <p>查询结果只按当前 Key 聚合，不会展开同用户下的其他 Key。</p>
    </section>
  );
}

function Dashboard({ data }: { data: UsageLookupResponse }) {
  const dailyMax = maxOf(data.daily.map((item) => item.requests));
  const modelMax = maxOf(data.models.map((item) => item.requests));
  const endpointMax = maxOf(data.endpoints.map((item) => item.requests));

  return (
    <div className="dashboard">
      <section className="key-strip" aria-label="当前 Key">
        <div>
          <span>当前 Key</span>
          <strong>{data.key.maskedKey}</strong>
        </div>
        <div>
          <span>Key 名称</span>
          <strong>{data.key.name || "未命名"}</strong>
        </div>
        <div>
          <span>最后使用</span>
          <strong>{formatDateTime(data.key.lastUsedAt)}</strong>
        </div>
        <div>
          <span>有效期</span>
          <strong>{formatDate(data.key.expiresAt)}</strong>
        </div>
      </section>

      <section className="stats-grid" aria-label="统计概览">
        <StatCard
          icon={<RadioTower aria-hidden="true" />}
          label="请求次数"
          value={data.summary.totalRequests}
          tone="green"
        />
        <StatCard
          icon={<CalendarDays aria-hidden="true" />}
          label="活跃天数"
          value={data.summary.activeDays}
          tone="gold"
        />
        <StatCard
          icon={<Layers3 aria-hidden="true" />}
          label="模型数量"
          value={data.summary.modelCount}
          tone="blue"
        />
        <StatCard
          icon={<Image aria-hidden="true" />}
          label="图片请求"
          value={data.summary.imageRequests}
          tone="coral"
        />
      </section>

      <section className="panel panel--wide">
        <div className="panel__header">
          <div>
            <span>Daily</span>
            <h2>日期趋势</h2>
          </div>
          <p>{data.range.replace("d", " 天")}</p>
        </div>
        <div className="timeline" aria-label="每日请求趋势">
          {data.daily.length === 0 ? (
            <p className="muted">这个时间范围内还没有调用记录。</p>
          ) : (
            data.daily.map((item) => (
              <div className="timeline__row" key={item.date}>
                <span>{item.date.slice(5)}</span>
                <div className="timeline__bar">
                  <i style={{ width: `${(item.requests / dailyMax) * 100}%` }} />
                </div>
                <strong>{item.requests}</strong>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="split-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span>Models</span>
              <h2>模型分布</h2>
            </div>
          </div>
          <div className="rank-list">
            {data.models.map((item) => (
              <div className="rank-list__item" key={item.model}>
                <div>
                  <strong>{item.model}</strong>
                  {item.imageRequests > 0 ? <small>图片 {item.imageRequests}</small> : null}
                </div>
                <span>{item.requests}</span>
                <i style={{ width: `${(item.requests / modelMax) * 100}%` }} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span>Endpoints</span>
              <h2>接口分布</h2>
            </div>
          </div>
          <div className="rank-list">
            {data.endpoints.map((item) => (
              <div className="rank-list__item" key={item.endpoint}>
                <div>
                  <strong>{item.endpoint}</strong>
                </div>
                <span>{item.requests}</span>
                <i style={{ width: `${(item.requests / endpointMax) * 100}%` }} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel panel--wide">
        <div className="panel__header">
          <div>
            <span>Latest</span>
            <h2>最近调用</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>模型</th>
                <th>接口</th>
                <th>模式</th>
                <th>图片</th>
                <th>服务层级</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((item) => (
                <tr key={`${item.createdAt}-${item.model}-${item.endpoint}`}>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{item.model}</td>
                  <td>{item.endpoint}</td>
                  <td>{item.stream ? "流式" : "普通"}</td>
                  <td>
                    {item.imageCount > 0
                      ? `${item.imageCount}${item.imageSize ? ` / ${item.imageSize}` : ""}`
                      : "无"}
                  </td>
                  <td>{item.serviceTier || "默认"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [range, setRange] = useState<UsageRange>("30d");
  const [lookupState, setLookupState] = useState<LookupState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      setLookupState({ status: "error", message: "请输入 API Key" });
      return;
    }

    startTransition(() => {
      setLookupState({ status: "loading" });
    });

    try {
      const response = await fetch("/api/usage/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ apiKey: trimmedKey, range })
      });
      const payload = (await response.json()) as
        | { ok: true; data: UsageLookupResponse }
        | { ok: false; message: string };

      if (!payload.ok) {
        setLookupState({ status: "error", message: payload.message });
        return;
      }

      setLookupState({ status: "success", data: payload.data });
      setApiKey("");
    } catch {
      setLookupState({ status: "error", message: "网络异常，请稍后再试" });
    }
  }

  return (
    <main className="page-shell">
      <section className="query-band" aria-labelledby="page-title">
        <div className="query-band__copy">
          <div className="eyebrow">
            <KeyRound aria-hidden="true" />
            API Key Usage
          </div>
          <h1 id="page-title">使用记录查询</h1>
          <p>输入你的 API Key，查看它自己的调用统计。</p>
        </div>

        <form className="query-card" onSubmit={handleSubmit}>
          <label htmlFor="api-key">API Key</label>
          <div className="key-input">
            <KeyRound aria-hidden="true" />
            <input
              autoComplete="off"
              id="api-key"
              name="api-key"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              spellCheck={false}
              type="password"
              value={apiKey}
            />
          </div>

          <div className="range-tabs" aria-label="查询范围">
            {ranges.map((item) => (
              <button
                aria-pressed={range === item.value}
                key={item.value}
                onClick={() => setRange(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button className="primary-button" disabled={lookupState.status === "loading"} type="submit">
            {lookupState.status === "loading" ? (
              <Loader2 aria-hidden="true" className="spin" />
            ) : (
              <Search aria-hidden="true" />
            )}
            查询统计
          </button>

          {lookupState.status === "error" ? (
            <p className="form-message form-message--error">
              <AlertCircle aria-hidden="true" />
              {lookupState.message}
            </p>
          ) : null}

          {lookupState.status === "success" ? (
            <p className="form-message form-message--success">
              <CheckCircle2 aria-hidden="true" />
              已加载最新统计
            </p>
          ) : null}
        </form>
      </section>

      <section className="guide-panel" aria-labelledby="guide-title">
        <div>
          <div className="guide-panel__title">
            <BookOpen aria-hidden="true" />
            <h2 id="guide-title">使用教程</h2>
          </div>
          <p>把客户端的 Base URL 配成下面这个地址，API Key 使用你后台生成的 `sk-...`。</p>
        </div>
        <div className="code-line">
          <code>{publicBaseUrl}</code>
          <ArrowRight aria-hidden="true" />
          <span>/v1 或 /responses</span>
        </div>
      </section>

      {lookupState.status === "success" ? <Dashboard data={lookupState.data} /> : <EmptyPanel />}

      <button
        aria-label="刷新当前页面"
        className="floating-refresh"
        onClick={() => window.location.reload()}
        type="button"
      >
        <RefreshCw aria-hidden="true" />
      </button>
    </main>
  );
}
