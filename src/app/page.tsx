"use client";

import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Image,
  KeyRound,
  Layers3,
  Loader2,
  LockKeyhole,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { ReactNode, FormEvent } from "react";
import { startTransition, useState } from "react";

import type { UsageLookupResponse, UsageRange } from "@/lib/usage";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: UsageLookupResponse }
  | { status: "error"; message: string };

const ranges: Array<{ label: string; value: UsageRange }> = [
  { label: "7 天", value: "7d" },
  { label: "30 天", value: "30d" },
  { label: "90 天", value: "90d" }
];

function createMockData(range: UsageRange): UsageLookupResponse {
  const today = new Date();
  const dayCount = range === "7d" ? 7 : range === "90d" ? 14 : 10;
  const daily = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (dayCount - index - 1));
    return {
      date: date.toISOString().slice(0, 10),
      requests: [26, 31, 44, 52, 39, 61, 74, 66, 58, 49, 71, 83, 92, 87][index] ?? 42,
      imageRequests: [2, 3, 4, 5, 3, 6, 7, 6, 5, 4, 7, 8, 9, 8][index] ?? 3
    };
  });

  return {
    key: {
      name: "示例 Key / Demo Key",
      maskedKey: "sk-demo...9f2c11",
      createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 45).toISOString(),
      lastUsedAt: new Date(today.getTime() - 1000 * 60 * 9).toISOString(),
      expiresAt: new Date(today.getTime() + 1000 * 60 * 60 * 24 * 45).toISOString()
    },
    range,
    summary: {
      totalRequests: daily.reduce((sum, item) => sum + item.requests, 0),
      activeDays: Math.max(9, Math.round(dayCount * 0.8)),
      modelCount: 6,
      endpointCount: 4,
      imageRequests: daily.reduce((sum, item) => sum + item.imageRequests, 0),
      firstRequestAt: new Date(today.getTime() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      lastRequestAt: new Date(today.getTime() - 1000 * 60 * 9).toISOString()
    },
    daily,
    models: [
      { model: "gpt-5.5", requests: 1480, imageRequests: 0 },
      { model: "gpt-5.4", requests: 920, imageRequests: 0 },
      { model: "gpt-image-2", requests: 312, imageRequests: 312 },
      { model: "gpt-5.4-mini", requests: 284, imageRequests: 0 },
      { model: "gpt-5-codex", requests: 168, imageRequests: 0 },
      { model: "gpt-4.1", requests: 96, imageRequests: 0 }
    ],
    endpoints: [
      { endpoint: "/responses", requests: 2410 },
      { endpoint: "/v1/chat/completions", requests: 514 },
      { endpoint: "/v1/images/generations", requests: 312 },
      { endpoint: "/v1/responses", requests: 304 }
    ],
    recent: [
      {
        createdAt: new Date(today.getTime() - 1000 * 60 * 3).toISOString(),
        model: "gpt-image-2",
        endpoint: "/v1/images/generations",
        stream: false,
        imageCount: 1,
        imageSize: "1024x1024",
        serviceTier: "default"
      },
      {
        createdAt: new Date(today.getTime() - 1000 * 60 * 16).toISOString(),
        model: "gpt-5.5",
        endpoint: "/responses",
        stream: true,
        imageCount: 0,
        imageSize: null,
        serviceTier: "flex"
      },
      {
        createdAt: new Date(today.getTime() - 1000 * 60 * 28).toISOString(),
        model: "gpt-5.4",
        endpoint: "/responses",
        stream: true,
        imageCount: 0,
        imageSize: null,
        serviceTier: "default"
      },
      {
        createdAt: new Date(today.getTime() - 1000 * 60 * 44).toISOString(),
        model: "gpt-4.1",
        endpoint: "/v1/chat/completions",
        stream: false,
        imageCount: 0,
        imageSize: null,
        serviceTier: "default"
      },
      {
        createdAt: new Date(today.getTime() - 1000 * 60 * 70).toISOString(),
        model: "gpt-5.4-mini",
        endpoint: "/v1/responses",
        stream: true,
        imageCount: 0,
        imageSize: null,
        serviceTier: "auto"
      },
      {
        createdAt: new Date(today.getTime() - 1000 * 60 * 88).toISOString(),
        model: "gpt-5-codex",
        endpoint: "/responses",
        stream: true,
        imageCount: 0,
        imageSize: null,
        serviceTier: "default"
      }
    ]
  };
}

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
  accent
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  accent: "emerald" | "amber" | "violet" | "cyan";
}) {
  return (
    <section className="stat-card">
      <div className={`stat-icon stat-icon--${accent}`}>{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
    </section>
  );
}

function EmptyPanel() {
  return (
    <section className="card empty-state">
      <div className="empty-state__icon">
        <LockKeyhole aria-hidden="true" />
      </div>
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
    <div className="dashboard fade-in">
      <section className="card info-card" aria-label="当前 Key">
        <div className="section-head">
          <div>
            <span className="section-kicker">Current Key</span>
            <h2>当前查询对象</h2>
          </div>
          <div className="section-chip">
            <KeyRound aria-hidden="true" />
            {data.key.maskedKey}
          </div>
        </div>
        <div className="info-grid">
          <article className="info-item">
            <span>Key 名称</span>
            <strong>{data.key.name || "未命名"}</strong>
          </article>
          <article className="info-item">
            <span>最后使用</span>
            <strong>{formatDateTime(data.key.lastUsedAt)}</strong>
          </article>
          <article className="info-item">
            <span>有效期</span>
            <strong>{formatDate(data.key.expiresAt)}</strong>
          </article>
          <article className="info-item">
            <span>创建时间</span>
            <strong>{formatDate(data.key.createdAt)}</strong>
          </article>
        </div>
      </section>

      <section className="stats-grid" aria-label="统计概览">
        <StatCard
          accent="emerald"
          icon={<RadioTower aria-hidden="true" />}
          label="请求次数"
          value={data.summary.totalRequests}
        />
        <StatCard
          accent="amber"
          icon={<CalendarDays aria-hidden="true" />}
          label="活跃天数"
          value={data.summary.activeDays}
        />
        <StatCard
          accent="violet"
          icon={<Layers3 aria-hidden="true" />}
          label="模型数量"
          value={data.summary.modelCount}
        />
        <StatCard
          accent="cyan"
          icon={<Image aria-hidden="true" />}
          label="图片请求"
          value={data.summary.imageRequests}
        />
      </section>

      <div className="content-grid">
        <section className="card card-section card-section--wide">
          <div className="section-head">
            <div>
              <span className="section-kicker">Daily Trend</span>
              <h2>日期趋势</h2>
            </div>
            <div className="section-badge">{data.range.replace("d", " 天")}</div>
          </div>
          <div className="timeline">
            {data.daily.length === 0 ? (
              <p className="muted">这个时间范围内还没有调用记录。</p>
            ) : (
              data.daily.map((item) => (
                <div className="timeline-row" key={item.date}>
                  <span>{item.date.slice(5)}</span>
                  <div className="timeline-bar">
                    <i style={{ width: `${(item.requests / dailyMax) * 100}%` }} />
                  </div>
                  <strong>{item.requests}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card card-section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Models</span>
              <h2>模型分布</h2>
            </div>
          </div>
          <div className="rank-list">
            {data.models.map((item) => (
              <div className="rank-item" key={item.model}>
                <div className="rank-item__head">
                  <div>
                    <strong>{item.model}</strong>
                    {item.imageRequests > 0 ? <small>图片 {item.imageRequests}</small> : null}
                  </div>
                  <span>{item.requests}</span>
                </div>
                <i className="rank-progress">
                  <b style={{ width: `${(item.requests / modelMax) * 100}%` }} />
                </i>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Endpoints</span>
              <h2>接口分布</h2>
            </div>
          </div>
          <div className="rank-list">
            {data.endpoints.map((item) => (
              <div className="rank-item" key={item.endpoint}>
                <div className="rank-item__head">
                  <strong>{item.endpoint}</strong>
                  <span>{item.requests}</span>
                </div>
                <i className="rank-progress">
                  <b style={{ width: `${(item.requests / endpointMax) * 100}%` }} />
                </i>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card card-section card-section--wide">
        <div className="section-head">
          <div>
            <span className="section-kicker">Latest Records</span>
            <h2>最近调用</h2>
          </div>
        </div>
        <div className="table-container">
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
                <tr className="table-row" key={`${item.createdAt}-${item.model}-${item.endpoint}`}>
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
    <main className="page-shell gradient-bg">
      <div className="page-shell__inner">
        <header className="hero-panel glass-strong">
          <div className="hero-panel__head">
            <div>
              <div className="hero-eyebrow">
                <Sparkles aria-hidden="true" />
                API Usage Center
              </div>
              <h1 className="header-title">API 使用统计</h1>
              <p className="hero-copy">
                输入你的 API Key，快速查看调用趋势、模型分布、接口分布和最近记录。
              </p>
            </div>
          </div>

          <form className="api-input-wide-card" onSubmit={handleSubmit}>
            <div className="wide-card-title">
              <div className="wide-card-title__icon">
                <BarChart3 aria-hidden="true" />
              </div>
              <div>
                <h2>API 统计查询</h2>
                <p>只按当前 Key 聚合，不展示费用、Token 和耗时。</p>
              </div>
            </div>

            <div className="api-input-grid">
              <label className="field-block" htmlFor="api-key">
                <span>API Key</span>
                <div className="wide-card-input">
                  <KeyRound aria-hidden="true" />
                  <input
                    autoComplete="off"
                    id="api-key"
                    name="api-key"
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="请输入 sk-..."
                    spellCheck={false}
                    type="password"
                    value={apiKey}
                  />
                </div>
              </label>

              <div className="field-block">
                <span>时间范围</span>
                <div className="period-group">
                  {ranges.map((item) => (
                    <button
                      aria-pressed={range === item.value}
                      className={`period-btn ${range === item.value ? "active" : ""}`}
                      key={item.value}
                      onClick={() => setRange(item.value)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-block field-block--button">
                <span>开始查询</span>
                <button className="btn btn-query btn-primary" disabled={lookupState.status === "loading"} type="submit">
                  {lookupState.status === "loading" ? (
                    <Loader2 aria-hidden="true" className="loading-spinner" />
                  ) : (
                    <Search aria-hidden="true" />
                  )}
                  查询统计
                </button>
              </div>
            </div>

          <div className="wide-card-foot">
            <div className="query-actions">
              <button className="btn btn-ghost" onClick={() => setLookupState({ status: "success", data: createMockData(range) })} type="button">
                查看示例数据
              </button>
              <button className="btn btn-ghost btn-ghost--soft" onClick={() => { setApiKey(""); setLookupState({ status: "idle" }); }} type="button">
                清空
              </button>
            </div>

            <div className="security-notice">
              <ShieldCheck aria-hidden="true" />
              API Key 只用于本次服务端查询，不会写入浏览器存储。
              </div>

              {lookupState.status === "error" ? (
                <p className="feedback feedback--error">
                  <AlertCircle aria-hidden="true" />
                  {lookupState.message}
                </p>
              ) : null}

              {lookupState.status === "success" ? (
                <p className="feedback feedback--success">
                  <CheckCircle2 aria-hidden="true" />
                  已加载最新统计
                </p>
              ) : null}
            </div>
          </form>
        </header>

      {lookupState.status === "success" ? <Dashboard data={lookupState.data} /> : <EmptyPanel />}
      </div>

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
