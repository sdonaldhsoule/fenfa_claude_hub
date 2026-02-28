"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Monitor,
  Settings,
  ArrowLeft,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "概览", icon: LayoutDashboard },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/sessions", label: "会话监控", icon: Monitor },
  { href: "/admin/settings", label: "策略配置", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen min-h-0">
      {/* 左侧边栏 */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-[#E8E8E0] bg-white">
        {/* Logo 区域 */}
        <div className="flex h-16 items-center px-6">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-[#D2691E]">CCH</span>{" "}
            <span className="text-gray-700">Admin</span>
          </span>
        </div>

        {/* 导航链接 */}
        <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#D2691E] text-white shadow-sm"
                    : "text-gray-600 hover:bg-[#FAFAF5] hover:text-gray-900"
                }`}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 底部返回链接 */}
        <div className="border-t border-[#E8E8E0] p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-[#FAFAF5] hover:text-gray-700"
          >
            <ArrowLeft className="size-5" />
            返回仪表盘
          </Link>
        </div>
      </aside>

      {/* 右侧主内容区 */}
      <main className="flex-1 overflow-y-auto bg-[#FAFAF5] p-8">
        {children}
      </main>
    </div>
  );
}
