import { useState } from "react";
import { Avatar } from "../design-system/components/Avatar.js";
import { Button } from "../design-system/components/Button.js";
import { Input } from "../design-system/components/Input.js";
import { Modal } from "../design-system/components/Modal.js";
import { DropdownMenu } from "../design-system/components/DropdownMenu.js";
import { useToast } from "../design-system/components/Toast.js";
import { useConfirm } from "../design-system/useConfirm.js";
import { useTheme } from "../design-system/ThemeProvider.js";
import { Logo, Wordmark, LogOutIcon, SettingsIcon, FilmIcon, GridIcon, TrashIcon, AlertIcon } from "../design-system/icons.js";
import { logout } from "../api/auth.api.js";
import { deleteAccount } from "../api/rooms.api.js";
import { disconnectSocket } from "../realtime/socket-client.js";
import { useAuthStore } from "../state/auth.store.js";
import { useNavStore } from "../state/nav.store.js";

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const leaveRoom = useNavStore((s) => s.leaveRoom);
  const goToHistory = useNavStore((s) => s.goToHistory);
  const goToMyRooms = useNavStore((s) => s.goToMyRooms);
  const { toast } = useToast();
  const confirm = useConfirm();
  const { toggleTheme } = useTheme();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmText.trim().toUpperCase() === "DELETE" && !deleting;

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

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      disconnectSocket();
      useAuthStore.getState().clear(); // session gone → app returns to the sign-in screen
      toast({ title: "Account deleted", description: "All your data has been removed.", tone: "neutral" });
    } catch {
      toast({ title: "Couldn't delete your account", description: "Please try again.", tone: "danger" });
      setDeleting(false);
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-8">
      <button onClick={leaveRoom} className="flex items-center gap-2 outline-none" aria-label="Go to lobby">
        {/* -top nudge compensates for the mark sitting slightly low in its tile,
            so it reads as optically centered with the wordmark. */}
        <Logo size={30} className="relative -top-px" />
        {/* leading-none keeps the wordmark optically centered with the icon.
            Always shown — the SyncWatch name carries the brand on every width. */}
        <Wordmark className="text-xl font-bold leading-none tracking-tight" />
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
          { label: "My rooms", icon: GridIcon, onSelect: goToMyRooms },
          { label: "Watch history", icon: FilmIcon, onSelect: goToHistory },
          { label: "Toggle theme", icon: SettingsIcon, onSelect: toggleTheme },
          { label: "Sign out", icon: LogOutIcon, tone: "danger", separatorBefore: true, onSelect: handleLogout },
          { label: "Delete account", icon: TrashIcon, tone: "danger", onSelect: () => setDeleteOpen(true) },
        ]}
      />

      {/* Delete-account confirmation — type DELETE to enable. Irreversible. */}
      <Modal
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteOpen(false);
            setConfirmText("");
          }
        }}
        icon={AlertIcon}
        tone="danger"
        title="Delete your account?"
        description="This permanently erases your account and everything tied to it — your rooms, memberships, and watch history. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDeleteOpen(false); setConfirmText(""); }} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteAccount} disabled={!canDelete}>
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </>
        }
      >
        <Input
          label={'Type "DELETE" to confirm'}
          placeholder="DELETE"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoFocus
        />
      </Modal>
    </header>
  );
}
