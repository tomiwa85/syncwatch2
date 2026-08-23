import { useState } from "react";
import type { RoomSummary, RoomVisibility } from "@syncwatch/shared";
import { Button } from "../design-system/components/Button.js";
import { Input } from "../design-system/components/Input.js";
import { Modal } from "../design-system/components/Modal.js";
import { useToast } from "../design-system/components/Toast.js";
import { PlusIcon, LockIcon, GlobeIcon } from "../design-system/icons.js";
import { ApiError } from "../api/http.js";
import { createRoom } from "../api/rooms.api.js";

interface CreateRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the created room (e.g. to enter it). */
  onCreated: (room: RoomSummary) => void;
}

// Shared "create a watch party" modal used from the lobby and My Rooms.
export function CreateRoomModal({ open, onOpenChange, onCreated }: CreateRoomModalProps) {
  const { toast } = useToast();
  const [visibility, setVisibility] = useState<RoomVisibility>("PRIVATE");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const room = await createRoom(visibility, { password: password.trim() || undefined });
      onOpenChange(false);
      setPassword("");
      toast({ title: "Room created", description: `Share code ${room.code} to invite people.`, tone: "success" });
      onCreated(room);
    } catch (err) {
      toast({ title: "Create failed", description: err instanceof ApiError ? err.message : "Could not create the room.", tone: "danger" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={PlusIcon}
      tone="brand"
      title="Create a watch party"
      description="Pick who can join. You can share the code either way."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create room"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { value: "PRIVATE", icon: LockIcon, title: "Private", desc: "Only people with the code" },
            { value: "PUBLIC", icon: GlobeIcon, title: "Public", desc: "Anyone can find & join" },
          ] as const
        ).map((opt) => {
          const active = visibility === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVisibility(opt.value)}
              className={
                "flex flex-col items-start gap-2 rounded-sw border p-4 text-left transition-all " +
                (active ? "border-accent bg-brand-soft" : "border-border bg-surface hover:border-border-strong")
              }
            >
              <span className={"flex h-9 w-9 items-center justify-center rounded-sw " + (active ? "bg-accent text-accent-fg" : "bg-surface-raised text-muted")}>
                <Icon size={18} />
              </span>
              <span className="font-medium">{opt.title}</span>
              <span className="text-xs text-muted">{opt.desc}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <Input
          label="Password (optional)"
          type="password"
          placeholder="Leave blank for no password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </Modal>
  );
}
