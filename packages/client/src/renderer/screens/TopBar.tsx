import { Avatar } from "../design-system/components/Avatar.js";
import { DropdownMenu } from "../design-system/components/DropdownMenu.js";
import { useToast } from "../design-system/components/Toast.js";
import { useConfirm } from "../design-system/useConfirm.js";
import { useTheme } from "../design-system/ThemeProvider.js";
import { Wordmark, LogOutIcon, SettingsIcon, FilmIcon } from "../design-system/icons.js";
import { logout } from "../api/auth.api.js";
import { useAuthStore } from "../state/auth.store.js";
import { useNavStore } from "../state/nav.store.js";

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const leaveRoom = useNavStore((s) => s.leaveRoom);
  const goToHistory = useNavStore((s) => s.goToHistory);
  const { toast } = useToast();
  const confirm = useConfirm();
  const { toggleTheme } = useTheme();

  async function handleLogout() {
    const ok = await confirm({
      title: "Sign out?",
      description: "You'll need to sign in again to rejoin your watch parties.",
      confirmLabel: "Sign out",
      tone: "danger",
    });
    if (!ok) return;
    await logout();
    leaveRoom();
    toast({ title: "Signed out" });
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-8 py-4">
      <button onClick={leaveRoom} className="outline-none" aria-label="Go to lobby">
        <Wordmark className="text-xl font-bold tracking-tight" />
      </button>
      <DropdownMenu
        align="end"
        label={user?.displayName ?? "Account"}
        trigger={
          <button className="rounded-full outline-none ring-accent transition focus-visible:ring-2">
            <Avatar name={user?.displayName ?? "?"} />
          </button>
        }
        items={[
          { label: "Watch history", icon: FilmIcon, onSelect: goToHistory },
          { label: "Toggle theme", icon: SettingsIcon, onSelect: toggleTheme },
          { label: "Sign out", icon: LogOutIcon, tone: "danger", separatorBefore: true, onSelect: handleLogout },
        ]}
      />
    </header>
  );
}
