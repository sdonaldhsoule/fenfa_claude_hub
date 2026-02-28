"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Terminal,
  BarChart3,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface KeyData {
  key: string;
  status: "active" | "auto_disabled";
  totalCalls: number;
  remainingQuota: number;
  autoDisabledAt: string | null;
  lastActivityAt: string | null;
  nextDailyReactivateAt: string | null;
  inactivityHours: number;
  dailyReactivateAtLabel: string;
}

interface UserKeyResponse {
  apiKey: {
    key: string;
    keyId: number | null;
    userId: number | null;
    status: "active" | "auto_disabled";
    autoDisabledAt: string | null;
  } | null;
  usage: {
    keyId: number;
    used: number;
    limit: number;
    remaining: number;
  } | null;
  policy: {
    inactivityHours: number;
    dailyReactivateAt: string;
    dailyReactivateHourBjt: number;
    dailyReactivateMinuteBjt: number;
    nextDailyReactivateAt: string;
    lastActivityAt: string;
  };
}

function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}${"*".repeat(8)}${key.slice(-4)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 cursor-pointer ${className || ""}`}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400" />
      )}
    </Button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-12 font-mono text-sm text-gray-800 overflow-x-auto">
        {code}
      </div>
      <div className="absolute top-1.5 right-1.5">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    async function fetchKeyData() {
      try {
        const res = await fetch("/api/user/key");
        if (res.ok) {
          const data: UserKeyResponse = await res.json();
          if (data.apiKey?.key) {
            setKeyData({
              key: data.apiKey.key,
              status: data.apiKey.status,
              totalCalls: data.usage?.used ?? 0,
              remainingQuota: data.usage?.remaining ?? 0,
              autoDisabledAt: data.apiKey.autoDisabledAt ?? null,
              lastActivityAt: data.policy?.lastActivityAt ?? null,
              nextDailyReactivateAt: data.policy?.nextDailyReactivateAt ?? null,
              inactivityHours: data.policy?.inactivityHours ?? 5,
              dailyReactivateAtLabel:
                data.policy?.dailyReactivateAt ?? "每天北京时间 08:00",
            });
          } else {
            setKeyData(null);
          }
        } else {
          setKeyData(null);
        }
      } catch {
        toast.error("获取 API Key 信息失败");
      } finally {
        setLoading(false);
      }
    }
    fetchKeyData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-48 h-8 rounded" />
        <Skeleton className="w-full h-52 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">仪表盘</h1>

      {/* API Key Card */}
      <Card className="rounded-2xl shadow-sm border bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D2691E] to-[#E8913A] flex items-center justify-center">
                <Terminal className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-base font-semibold">
                你的 API Key
              </CardTitle>
            </div>
            {keyData && (
              <Badge
                variant={
                  keyData.status === "active" ? "secondary" : "destructive"
                }
                className={
                  keyData.status === "active"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : ""
                }
              >
                {keyData.status === "active" ? "活跃" : "自动停用"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {keyData ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-800 overflow-hidden">
                {showKey ? keyData.key : maskKey(keyData.key)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 cursor-pointer shrink-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4 text-gray-500" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-500" />
                )}
              </Button>
              <CopyButton text={keyData.key} className="shrink-0" />
            </div>
          ) : (
            <p className="text-sm text-gray-500">暂无 API Key 数据</p>
          )}

          {keyData?.status === "auto_disabled" && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p>
                密钥因连续 {keyData.inactivityHours} 小时无登录且无 API 调用而自动停用。
              </p>
              <p className="mt-1">
                重新访问登录页并登录可立即恢复；
                {keyData.nextDailyReactivateAt
                  ? `系统也会在${keyData.dailyReactivateAtLabel}（下一次约 ${formatDate(
                      keyData.nextDailyReactivateAt
                    )}）统一恢复。`
                  : `系统也会在${keyData.dailyReactivateAtLabel}统一恢复。`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Usage Stats Card */}
        <Card className="rounded-2xl shadow-sm border bg-white">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D2691E] to-[#E8913A] flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-base font-semibold">
                使用统计
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">总调用次数</span>
                <span className="text-sm font-medium text-gray-900">
                  {keyData ? keyData.totalCalls.toLocaleString() : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">剩余配额</span>
                <span className="text-sm font-medium text-gray-900">
                  {keyData ? keyData.remainingQuota.toLocaleString() : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">上次活跃时间</span>
                <span className="text-sm font-medium text-gray-900">
                  {keyData ? formatDate(keyData.lastActivityAt) : "-"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Start Card */}
        <Card className="rounded-2xl shadow-sm border bg-white">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D2691E] to-[#E8913A] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-base font-semibold">
                快速开始
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  1. 设置 OpenAI 兼容端点
                </p>
                <CodeBlock code="export OPENAI_BASE_URL=https://lucky-claude-hub.zeabur.app" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  2. 设置 API Key
                </p>
                <CodeBlock
                  code={`export OPENAI_API_KEY=${keyData ? keyData.key : "your-api-key"}`}
                />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  3. 在 Codex CLI 选择 GPT 模型
                </p>
                <CodeBlock code="codex --model gpt-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
