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

import { SampleLetterCard } from "../../components/SampleLetterCard";
import { ScreenLayout } from "../../components/ScreenLayout";
import { ShareAppButton } from "../../components/ShareAppButton";
import { listInboxBottles } from "../../data/bottles";
import { useInterstitialAd } from "../../hooks/useInterstitialAd";
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
  const { maybeShow } = useInterstitialAd();

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

  // 로그인 전 — 빈 화면 대신 맛보기 편지를 먼저 읽게 하고, 로그인은 그다음에 권해요.
  if (profile == null) {
    return (
      <ScreenLayout
        title="받은 편지함"
        background="sky"
        footer={
          <Button
            display="full"
            size="xlarge"
            onClick={() => navigate({ name: "onboarding" })}
          >
            시작하고 내 편지 받기
          </Button>
        }
      >
        <Paragraph
          typography="t7"
          color={ocean.white}
          style={{ margin: "0 4px 12px", lineHeight: 1.6, opacity: 0.9 }}
        >
          시작하면 낯선 누군가의 익명 편지가 여기로 랜덤으로 도착해요. 먼저
          어떤 편지들이 오가는지 읽어보세요.
        </Paragraph>
        <SampleLetterCard context="receive_logged_out" />
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
        /* 빈 편지함 — 그냥 비워두면 바로 나가요. 읽을거리와 할 일을 같이 놓아요. */
        <>
          <div style={{ ...glassCard, textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌊</div>
            <Paragraph
              typography="t6"
              color={ocean.ink}
              style={{ margin: 0, lineHeight: 1.6, opacity: 0.85 }}
            >
              아직 도착한 편지가 없어요.
              <br />
              편지는 누군가 띄우는 순간 무작위로 배달돼요. 사람이 많을수록 더
              자주 도착해요.
            </Paragraph>
            <div style={{ marginTop: 16 }}>
              <ShareAppButton context="inbox_empty" label="🔗 친구에게 알리기" />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <SampleLetterCard context="inbox_empty" />
          </div>
        </>
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
                  onClick={() =>
                    maybeShow(
                      () => navigate({ name: "read", bottleId: b.id }),
                      "read",
                    )
                  }
                />
              ))}
            </List>
          </div>
        </>
      )}
    </ScreenLayout>
  );
}
