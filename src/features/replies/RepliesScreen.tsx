import { useCallback, useEffect, useState } from "react";

import {
  Badge,
  Button,
  List,
  ListRow,
  Loader,
  Paragraph,
  useToast,
} from "@toss/tds-mobile";

import { ScreenLayout } from "../../components/ScreenLayout";
import { ShareAppButton } from "../../components/ShareAppButton";
import { getBottle } from "../../data/bottles";
import { listReceivedReplies, markReplyRead } from "../../data/replies";
import { EVENT, track } from "../../lib/analytics";
import { useRouter } from "../../router";
import { useSession } from "../../session";
import type { Bottle, Reply, ReplyStatus } from "../../types";
import { bottleEmoji, glassCard, ocean } from "../../theme";
import { LoginUpsell } from "../auth/LoginUpsell";
import { ReportButton } from "../moderation/ReportButton";

type BadgeColor = "blue" | "teal" | "green" | "red" | "yellow" | "elephant";

const STATUS_META: Record<ReplyStatus, { label: string; color: BadgeColor }> = {
  sent: { label: "새 답장", color: "red" },
  read: { label: "읽음", color: "blue" },
  chatOpened: { label: "읽음", color: "blue" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

function preview(text: string, max = 40): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

export function RepliesScreen() {
  const { openToast } = useToast();
  const { navigate } = useRouter();
  const { isGuest } = useSession();

  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bottleCache, setBottleCache] = useState<Record<string, Bottle | null>>(
    {},
  );

  const load = useCallback(async () => {
    try {
      const list = await listReceivedReplies();
      setReplies(list);
    } catch {
      openToast("답장을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [openToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadBottle = useCallback(
    async (bottleId: string) => {
      if (bottleId in bottleCache) return;
      try {
        const b = await getBottle(bottleId);
        setBottleCache((prev) => ({ ...prev, [bottleId]: b }));
      } catch {
        setBottleCache((prev) => ({ ...prev, [bottleId]: null }));
      }
    },
    [bottleCache],
  );

  const handleSelect = useCallback(
    async (reply: Reply) => {
      if (expandedId === reply.id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(reply.id);
      void loadBottle(reply.bottleId);

      if (reply.status === "sent") {
        try {
          await markReplyRead(reply.id);
          track(EVENT.replyReceived, {});
          await load();
        } catch {
          // 읽음 처리 실패는 무시해요.
        }
      }
    },
    [expandedId, loadBottle, load],
  );

  if (loading) {
    return (
      <ScreenLayout title="답장함" background="sky">
        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}
        >
          <Loader size="medium" />
        </div>
      </ScreenLayout>
    );
  }

  if (replies.length === 0) {
    return (
      <ScreenLayout title="답장함" background="sky">
        <div
          style={{
            ...glassCard,
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1 }}>{bottleEmoji}</div>
          <Paragraph
            typography="t6"
            color={ocean.ink}
            style={{ margin: 0, lineHeight: 1.6 }}
          >
            아직 받은 답장이 없어요.
            <br />
            편지를 한 통 더 띄우면 답장이 올 확률도 올라가요.
          </Paragraph>
          <Button
            size="xlarge"
            display="full"
            onClick={() => navigate({ name: "compose" })}
          >
            ✉️ 편지 띄우러 가기
          </Button>
          <ShareAppButton
            context="replies_empty"
            label="🔗 친구에게 알리기"
            weak
            size="large"
          />
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title="답장함" background="sky">
      {isGuest && <LoginUpsell subject="답장" />}
      <div style={{ ...glassCard, marginTop: 8, padding: 8 }}>
        <List>
          {replies.map((reply) => {
            const meta = STATUS_META[reply.status];
            const expanded = expandedId === reply.id;
            const bottle = bottleCache[reply.bottleId];

            return (
              <div key={reply.id}>
                <ListRow
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={preview(reply.content)}
                      bottom={formatTime(reply.createdAt)}
                    />
                  }
                  right={
                    <Badge size="small" variant="weak" color={meta.color}>
                      {meta.label}
                    </Badge>
                  }
                  withArrow
                  onClick={() => {
                    void handleSelect(reply);
                  }}
                />

                {expanded && (
                  <div
                    style={{
                      padding: "4px 16px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {/* 답장 전체 내용 */}
                    <div>
                      <Paragraph
                        typography="t7"
                        fontWeight="bold"
                        color={ocean.ink}
                        style={{ opacity: 0.7, marginBottom: 6 }}
                      >
                        받은 답장
                      </Paragraph>
                      <Paragraph
                        typography="t6"
                        color={ocean.ink}
                        style={{
                          margin: 0,
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {reply.content}
                      </Paragraph>
                    </div>

                    {/* 원본 편지 */}
                    {bottle != null && (
                      <div
                        style={{
                          borderTop: "1px solid rgba(27,59,111,0.12)",
                          paddingTop: 12,
                        }}
                      >
                        <Paragraph
                          typography="t7"
                          fontWeight="bold"
                          color={ocean.ink}
                          style={{ opacity: 0.7, marginBottom: 6 }}
                        >
                          {bottleEmoji} 내가 띄운 편지
                        </Paragraph>
                        <Paragraph
                          typography="t6"
                          color={ocean.ink}
                          style={{
                            margin: 0,
                            lineHeight: 1.7,
                            opacity: 0.85,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {bottle.content}
                        </Paragraph>
                      </div>
                    )}

                    <Paragraph
                      typography="t7"
                      color={ocean.ink}
                      style={{ margin: 0, opacity: 0.55 }}
                    >
                      익명 편지는 한 번의 답장으로 마무리돼요. 🌊
                    </Paragraph>

                    {/* 답장을 막 읽은 순간이 공유가 가장 잘 나오는 지점이에요. */}
                    <ShareAppButton
                      context="reply_read"
                      label="🔗 이 편지 앱 친구에게 알리기"
                      weak
                      size="large"
                    />

                    <div style={{ textAlign: "right" }}>
                      <ReportButton
                        tone="dark"
                        allowBlock={false}
                        target={{
                          reportedId: reply.fromId,
                          contextType: "reply",
                          contextId: reply.id,
                          snapshot: reply.content,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </List>
      </div>
    </ScreenLayout>
  );
}
