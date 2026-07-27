import { useState } from "react";
import { Button } from "../design-system/components/Button.js";
import { Input } from "../design-system/components/Input.js";
import { Card } from "../design-system/components/Card.js";
import { Avatar } from "../design-system/components/Avatar.js";
import { Badge } from "../design-system/components/Badge.js";
import { Modal } from "../design-system/components/Modal.js";
import { DropdownMenu } from "../design-system/components/DropdownMenu.js";
import { Tooltip } from "../design-system/components/Tooltip.js";
import { useToast } from "../design-system/components/Toast.js";
import { useConfirm } from "../design-system/useConfirm.js";
import { useTheme } from "../design-system/ThemeProvider.js";
import {
  Logo,
  MessageIcon,
  CopyIcon,
  SettingsIcon,
  LogOutIcon,
  LinkIcon,
  FilmIcon,
  LockIcon,
  GlobeIcon,
} from "../design-system/icons.js";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </Card>
  );
}

export function DesignSystemPreview() {
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-full p-10">
      <header className="mb-8 flex items-center justify-between">
        <Logo size={96} />
        <Button variant="secondary" onClick={toggleTheme}>
          Theme: {theme}
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button variant="gradient">
              <FilmIcon size={17} /> Gradient
            </Button>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Inputs">
          <Input label="Email" placeholder="you@example.com" />
          <Input label="Password" type="password" placeholder="••••••••" />
          <Input label="With error" defaultValue="bad" error="Something is wrong" />
        </Section>

        <Section title="Avatars & Badges">
          <div className="flex items-center gap-3">
            <Avatar name="Olatomiwa Ojo" size="lg" />
            <Avatar name="Jane Doe" />
            <Avatar name="Sam" size="sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Host</Badge>
            <Badge tone="success">Verified</Badge>
            <Badge tone="danger">Mismatch</Badge>
          </div>
        </Section>

        <Section title="Overlays">
          <div className="flex flex-wrap gap-3">
            <Button variant="gradient" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
            <DropdownMenu
              label="Room"
              trigger={<Button variant="secondary">Room menu</Button>}
              items={[
                { label: "Copy room code", icon: CopyIcon, onSelect: () => toast({ title: "Room code copied", tone: "success" }) },
                { label: "Copy invite link", icon: LinkIcon, onSelect: () => toast({ title: "Invite link copied", tone: "success" }) },
                { label: "Room settings", icon: SettingsIcon, onSelect: () => toast({ title: "Opening settings" }) },
                { label: "Leave room", icon: LogOutIcon, tone: "danger", separatorBefore: true, onSelect: () => toast({ title: "You left the room", tone: "danger" }) },
              ]}
            />
            <Tooltip content="Only people with the code can join">
              <Button variant="ghost">
                <LockIcon size={16} /> Private
              </Button>
            </Tooltip>
          </div>
        </Section>

        <Section title="Toasts">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => toast({ title: "Alex joined", tone: "neutral", description: "Say hi in the room." })}>
              Info toast
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: "File verified", tone: "success", description: "Everyone has the same copy." })}>
              Success toast
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: "Sync lost", tone: "danger", description: "Reconnecting to the room…" })}>
              Danger toast
            </Button>
          </div>
        </Section>

        <Section title="Confirm dialog">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              onClick={async () => {
                const ok = await confirm({
                  title: "Leave this room?",
                  description: "You can rejoin anytime with the room code.",
                  confirmLabel: "Leave",
                  tone: "danger",
                });
                toast({ title: ok ? "You left the room" : "Stayed in the room", tone: ok ? "danger" : "neutral" });
              }}
            >
              Danger confirm
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await confirm({
                  title: "Switch the video source?",
                  description: "This resets playback to the start for everyone in the room.",
                  confirmLabel: "Switch",
                });
                if (ok) toast({ title: "Source switched", tone: "success" });
              }}
            >
              Brand confirm
            </Button>
          </div>
        </Section>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        icon={MessageIcon}
        tone="brand"
        title="Create a watch party"
        description="This is a fully custom, themed modal — no native dialog."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={() => setModalOpen(false)}>
              Create room
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Room name" placeholder="Friday movie night" />
          <div className="flex gap-2">
            <Badge tone="accent">
              <GlobeIcon size={13} /> Public
            </Badge>
            <Badge>
              <LockIcon size={13} /> Private
            </Badge>
          </div>
        </div>
      </Modal>
    </div>
  );
}
