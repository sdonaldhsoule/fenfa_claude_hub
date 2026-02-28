"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Terminal, LogOut, Shield, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface User {
  id: string;
  username: string;
  avatarTemplate: string | null;
  role: string;
  trustLevel: number;
}

function getAvatarUrl(avatarTemplate: string | null): string | null {
  if (!avatarTemplate) return null;
  const url = avatarTemplate.replace("{size}", "80");
  return url.startsWith("http") ? url : `https://linux.do${url}`;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/");
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/");
  };

  const roleLabelMap: Record<string, string> = {
    ADMIN: "管理员",
    USER: "用户",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF5]">
        {/* Navbar Skeleton */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="w-32 h-5 rounded" />
            </div>
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">
            <Skeleton className="w-48 h-8 rounded" />
            <Skeleton className="w-full h-48 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF5]">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D2691E] to-[#E8913A] flex items-center justify-center">
              <Terminal className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">
              CCH Distributor
            </span>
          </Link>

          {/* Right: User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full hover:bg-gray-50 p-1 pr-2 transition-colors cursor-pointer outline-none">
                <Avatar className="w-8 h-8">
                  {getAvatarUrl(user.avatarTemplate) ? (
                    <AvatarImage src={getAvatarUrl(user.avatarTemplate) ?? undefined} alt={user.username} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-[#D2691E] to-[#E8913A] text-white text-xs">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{user.username}</p>
                  <Badge
                    variant="secondary"
                    className="w-fit text-xs"
                  >
                    {roleLabelMap[user.role] || user.role}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user.role === "ADMIN" && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push("/admin")}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  管理后台
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
