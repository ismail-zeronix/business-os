"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { InitialsAvatar } from "@/components/application/soft-pill";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { UserRole } from "@/generated/prisma/enums";
import { USER_ROLE_LABEL } from "@/lib/labels";
import { signOutAction } from "@/modules/users/actions";
import { ChangePasswordForm } from "@/modules/users/components/change-password-form";

export type Account = { name: string; email: string; role: UserRole };

/**
 * The account menu in the top navbar. Signed in: name, email and role, Change password, Sign out. While sign-in is not set up: says so and
 * links to the one-time setup. Settings (with Users) is shown to admins only.
 */
export function AccountMenu({ account, signedIn }: { account: Account | null; signedIn: boolean }) {
  const [changingPassword, setChangingPassword] = useState(false);
  const isAdmin = account?.role === "ADMIN";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Account menu" className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60">
            <InitialsAvatar name={account?.name ?? "?"} size={36} muted={!account} />
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-sm font-semibold">{account?.name ?? "Unavailable"}</span>
              <span className="block text-xs text-muted-foreground">{signedIn && account ? USER_ROLE_LABEL[account.role] : "Not signed in"}</span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground md:block" strokeWidth={1.5} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-0.5 py-2">
            <span className="block text-sm font-medium text-foreground">{account?.name ?? "Unavailable"}</span>
            <span className="block text-xs font-normal text-muted-foreground">{signedIn && account ? `${account.email} · ${USER_ROLE_LABEL[account.role]}` : "Sign-in is not set up"}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isAdmin ? (
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href="/audit">Audit log</Link>
          </DropdownMenuItem>
          {signedIn ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setChangingPassword(true)}>Change password</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <form action={signOutAction}>
                  <button type="submit" className="w-full text-left">
                    Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </>
          ) : isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/setup">Set up sign-in</Link>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={changingPassword} onOpenChange={setChangingPassword}>
        <SheetContent className="w-full gap-0 sm:max-w-[30rem]">
          <SheetHeader className="border-b pr-12">
            <SheetTitle className="text-base">Change password</SheetTitle>
            <SheetDescription className="text-xs">Your other sessions are signed out; this one stays.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <ChangePasswordForm onDone={() => setChangingPassword(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
