import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { platformPath, readJson, writeJson } from "@/lib/storage/fs";
import { ROLE_IDS, type Role } from "./roles";
import { SLUG_RE } from "./slug";

/** Event slug to role, as the owner's access page sends it. */
export const EventsSchema = z.record(z.string().regex(SLUG_RE), z.enum(ROLE_IDS));

/** An operator: someone the owner let into specific events, e.g. a photographer who runs the stations himself. */
export type Account = {
  id: string;
  username: string;
  name: string;
  passwordHash: string;
  /** Event slug to role. Events not listed here do not exist as far as this account can tell. */
  events: Record<string, Role>;
  disabled: boolean;
  /** Raised on password change, disable or role change: every older session of the account stops working. */
  sessionVersion: number;
  createdAt: string;
  lastLoginAt?: string;
};

/** What the owner's screens get: never the password hash. */
export type AccountView = Omit<Account, "passwordHash">;
export const toView = ({ passwordHash: _omit, ...rest }: Account): AccountView => rest;

const file = () => platformPath("accounts.json");

// All writes go through one chain, so two owner actions at the same moment do not lose each other's change.
let chain: Promise<unknown> = Promise.resolve();

export async function listAccounts(): Promise<Account[]> {
  return (await readJson<Account[]>(file())) ?? [];
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return (await listAccounts()).find((a) => a.id === id);
}

export async function findByUsername(username: string): Promise<Account | undefined> {
  const key = username.trim().toLowerCase();
  return (await listAccounts()).find((a) => a.username === key);
}

export function mutateAccounts<T>(fn: (accounts: Account[]) => T): Promise<T> {
  const next = chain.then(async () => {
    const accounts = await listAccounts();
    const result = fn(accounts);
    await writeJson(file(), accounts, 0o600);
    return result;
  });
  chain = next.catch(() => undefined);
  return next;
}

export const newAccountId = () => randomBytes(9).toString("base64url");
