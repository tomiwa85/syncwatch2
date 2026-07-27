import crypto from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import ms from "ms";
import type { AuthUser, LoginRequest, SignupRequest } from "@syncwatch/shared";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";

export class AuthError extends Error {}

function toAuthUser(user: { id: string; email: string; displayName: string }): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function issueAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("hex");
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + ms(env.REFRESH_TOKEN_TTL)),
    },
  });
  return token;
}

export async function signup(input: SignupRequest) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("An account with this email already exists");

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, displayName: input.displayName },
  });

  const accessToken = issueAccessToken(user.id);
  const refreshToken = await issueRefreshToken(user.id);
  return { user: toAuthUser(user), accessToken, refreshToken };
}

export async function login(input: LoginRequest) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AuthError("Invalid email or password");

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) throw new AuthError("Invalid email or password");

  const accessToken = issueAccessToken(user.id);
  const refreshToken = await issueRefreshToken(user.id);
  return { user: toAuthUser(user), accessToken, refreshToken };
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AuthError("Invalid or expired refresh token");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const accessToken = issueAccessToken(stored.userId);
  const newRefreshToken = await issueRefreshToken(stored.userId);
  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function verifyAccessToken(token: string): { userId: string } {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new AuthError("Invalid access token");
  }
  return { userId: payload.sub };
}
