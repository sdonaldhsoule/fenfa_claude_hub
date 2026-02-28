import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

// ==================== 类型定义 ====================

export interface JWTPayload {
  userId: string;
  linuxdoId: number;
  username: string;
  role: string;
}

export interface Session extends JWTPayload {
  iat: number;
  exp: number;
}

// ==================== 内部工具 ====================

function getJwtSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET 环境变量未设置");
  }
  return new TextEncoder().encode(jwtSecret);
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY 环境变量未设置");
  }
  // 确保密钥为 32 字节 (256 bit)
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

// ==================== JWT 方法 ====================

/**
 * 使用 HS256 签名 JWT，有效期 7 天
 */
export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

/**
 * 验证 JWT 并返回 payload
 */
export async function verifyJWT(token: string): Promise<Session> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as Session;
  } catch {
    throw new Error("无效或已过期的 JWT token");
  }
}

// ==================== AES-256-GCM 加密/解密 ====================

/**
 * AES-256-GCM 加密
 * 返回格式: iv:authTag:ciphertext (全部为 hex 编码)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM 推荐 12 字节 IV

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * AES-256-GCM 解密
 * 输入格式: iv:authTag:ciphertext (全部为 hex 编码)
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("加密数据格式无效，期望格式: iv:authTag:ciphertext");
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// ==================== Session 方法 ====================

/**
 * 从 cookies 中获取当前用户 session
 * 如果未登录或 token 无效，返回 null
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
      return null;
    }

    const session = await verifyJWT(token);
    return session;
  } catch {
    return null;
  }
}

/**
 * 清除 session cookie
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
