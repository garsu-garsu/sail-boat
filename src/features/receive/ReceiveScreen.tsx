import {
  Badge,
  Button,
  List,
  ListRow,
  Loader,
  Paragraph,
  useToast,
} from "@toss/tds-mobile";
import { useCallback, useEffect, useState } from "react";

import { ScreenLayout } from "../../components/ScreenLayout";
import { listInboxBottles } from "../../data/bottles";
import { useRouter } from "../../router";
import { useSession } from "../../session";
import { glassCard, ocean } from "../../theme";
import type { Bottle } from "../../types";
import { LoginUpsell } from "../auth/LoginUpsell";

function previewOf(content: string): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length > 28 ? `${oneLine.slice(0, 28)}…` : oneLine;
}

export function ReceiveScreen() {
  const { navigate } = useRouter();
  const { profile, isGuest } = useSession();
  const { openToast } = useToast();

  const [inbox, setInbox] = useState<Bottle[] | null>(null);

  const load = useCallback(async () => {
    try {
      setInbox(await listInboxBottles());
    } catch (e) {
      console.error("받은 편지함 조회 실패:", e);
      setInbox([]);
      openToast("받은 편지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }, [openToast]);

  useEffect(() => {
    if (profile != null) void load();
  }, [profile, load]);

  // 로그인 전 안내
  if (profile == null) {
    return (
      <ScreenLayout title="받은 편지함" background="sky">
        <div style={{ ...glassCard, textAlign: "center", marginTop: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📩</div>
          <Paragraph
            typography="t6"
            color={ocean.ink}
            style={{ margin: "0 0 20px", lineHeight: 1.6 }}
          >
            받은 편지를 보려면
            <br />
            먼저 항해를 시작해 주세요.
          </Paragraph>
          <Button
            display="full"
            size="large"
            onClick={() => navigate({ name: "onboarding" })}
          >
            항해 시작하기
          </Button>
        </div>
      </ScreenLayout>
    );
  }

  const unreadCount = inbox?.filter((b) => b.status === "sent").length ?? 0;

  return (
    <ScreenLayout
      title="받은 편지함"
      background="sky"
      footer={
        <Button
          display="full"
          size="xlarge"
          onClick={() => navigate({ name: "compose" })}
        >
          ✉️ 나도 편지 보내기
        </Button>
      }
    >
      {inbox == null ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
          <Loader type="light" />
        </div>
      ) : inbox.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", marginTop: 24, padding: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌊</div>
          <Paragraph
            typography="t6"
            color={ocean.ink}
            style={{ margin: 0, lineHeight: 1.6, opacity: 0.85 }}
          >
            아직 받은 편지가 없어요.
            <br />
            먼저 편지를 보내면 누군가의 답장이 올 수도 있어요!
          </Paragraph>
        </div>
      ) : (
        <>
          {isGuest && <LoginUpsell subject="편지" />}
          {unreadCount > 0 && (
            <Paragraph
              typography="t7"
              fontWeight="semibold"
              color={ocean.white}
              style={{ margin: "4px 4px 10px" }}
            >
              읽지 않은 편지 {unreadCount}통이 도착했어요. 💌
            </Paragraph>
          )}
          <div style={{ ...glassCard, padding: 4 }}>
            <List>
              {inbox.map((b) => (
                <ListRow
                  key={b.id}
                  contents={
                    <ListRow.Texts
                      type="2RowTypeB"
                      top={previewOf(b.content)}
                      bottom={new Date(b.createdAt).toLocaleDateString("ko-KR")}
                    />
                  }
                  right={
                    b.status === "sent" ? (
                      <Badge size="small" color="red" variant="fill">
                        새 편지
                      </Badge>
                    ) : undefined
                  }
                  withArrow
                  onClick={() => navigate({ name: "read", bottleId: b.id })}
                />
              ))}
            </List>
          </div>
        </>
      )}
    </ScreenLayout>
  );
}
