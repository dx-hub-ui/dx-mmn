"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { Badge, IconButton } from "@vibe/core";
import { Inbox } from "@vibe/icons";
import InboxModal from "@/components/inbox/InboxModal";
import type { NotificationCountResponse } from "@/types/notifications";
import { trackEvent } from "@/lib/telemetry";
import { getRequestContext } from "@/lib/request-context";

const COUNT_ENDPOINT = "/api/notifications/count";

const fetcher = async (input: string): Promise<NotificationCountResponse> => {
  const response = await fetch(input, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar contador (${response.status})`);
  }
  return response.json();
};

type InboxIconButtonProps = {
  orgId: string;
};

export default function InboxIconButton({ orgId }: InboxIconButtonProps) {
  const [open, setOpen] = useState(false);
  const context = getRequestContext();
  const { data, mutate } = useSWR<NotificationCountResponse>(
    orgId ? `${COUNT_ENDPOINT}?orgId=${encodeURIComponent(orgId)}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const unreadCount = data?.unreadCount ?? 0;

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        trackEvent("inbox.trigger_click", { org_id: orgId, user_id: context?.userId ?? undefined });
      }
      return next;
    });
  }, [context?.userId, orgId]);

  return (
    <>
      <div>
        {unreadCount > 0 ? (
          <Badge
            type={Badge.types.COUNTER}
            count={unreadCount}
            maxDigits={3}
            anchor={Badge.anchors.TOP_END}
            alignment={Badge.alignments.OUTSIDE}
          >
            <IconButton
              icon={Inbox}
              ariaLabel="Inbox"
              tooltipContent="Inbox"
              size={IconButton.sizes.MEDIUM}
              kind={IconButton.kinds.TERTIARY}
              onClick={handleToggle}
            />
          </Badge>
        ) : (
          <IconButton
            icon={Inbox}
            ariaLabel="Inbox"
            tooltipContent="Inbox"
            size={IconButton.sizes.MEDIUM}
            kind={IconButton.kinds.TERTIARY}
            onClick={handleToggle}
          />
        )}
      </div>
      {open ? (
        <InboxModal
          open={open}
          orgId={orgId}
          initialTab="all"
          onClose={() => {
            setOpen(false);
            mutate();
          }}
        />
      ) : null}
    </>
  );
}
