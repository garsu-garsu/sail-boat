import { Button, Loader, Paragraph } from "@toss/tds-mobile";
import { useEffect, useState } from "react";

import { ScreenLayout } from "../../components/ScreenLayout";
import { getBottle, markBottleRead } from "../../data/bottles";
import { hasCrisisSignal } from "../../data/moderation";
import { hasRepliedToBottle } from "../../data/replies";
import { ReportButton } from "../moderation/ReportButton";
import { SupportNotice } from "../safety/SupportNotice";
import { useRouter } from "../../router";
import { useSession } from "../../session";
import { bottleEmoji, glassCard, ocean } from "../../theme";
import {
  AGE_BAND_LABEL,
  GENDER_LABEL,
  NATIONALITY_LABEL,
  anonNickname,
  type Bottle,
} from "../../types";

/** 작성자 인구통계 → "20대 · 여성 · 내국인" (없는 항목 생략, 전부 없으면 익명) */
function authorLine(b: Bottle): string {
  const parts: string[] = [];
  if (b.authorAgeBand != null) parts.push(AGE_BAND_LABEL[b.authorAgeBand]);
  if (b.authorGender != null) parts.push(GENDER_LABEL[b.authorGender]);
  if (b.authorNationality != null)
    parts.push(NATIONALITY_LABEL[b.authorNationality]);
  return parts.length > 0 ? parts.join(" · ") : anonNickname(b.authorAnonNo);
}

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ReadScreen({ bottleId }: { bottleId: string }) {
  const { navigate, back } = useRouter();
  const { profile } = useSession();

  const [bottle, setBottle] = useState<Bottle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyReplied, setAlreadyReplied] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const b = await getBottle(bottleId);
        if (!alive) return;
        if (b == null) {
          setNotFound(true);
        } else {
          setBottle(b);
          // 받은 사람이 열면 읽음 처리 (작성자가 열면 RLS 로 0건 → 무해)
          if (b.status === "sent") void markBottleRead(b.id).catch(() => {});
          // 이미 답장한 편지면 답장 버튼을 막아요.
          void hasRepliedToBottle(bottleId)
            .then((replied) => {
              if (alive) setAlreadyReplied(replied);
            })
            .catch(() => {});
        }
      } catch (e) {
        console.error("유리병 조회 실패:", e);
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [bottleId]);

  if (loading) {
    return (
      <ScreenLayout title="받은 편지" background="sky">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 64,
          }}
        >
          <Loader size="medium" type="light" label="유리병을 여는 중이에요" />
        </div>
      </ScreenLayout>
    );
  }

  if (notFound || bottle == null) {
    return (
      <ScreenLayout
        title="받은 편지"
        background="sky"
        footer={
          <Button display="full" size="large" onClick={back}>
            돌아가기
          </Button>
        }
      >
        <div style={{ ...glassCard, textAlign: "center", marginTop: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{bottleEmoji}</div>
          <Paragraph typography="t6" color={ocean.ink} style={{ margin: 0 }}>
            유리병을 찾을 수 없어요.
          </Paragraph>
        </div>
      </ScreenLayout>
    );
  }

  const canReport = profile != null && profile.id !== bottle.authorId;

  return (
    <ScreenLayout
      title="받은 편지"
      background="sky"
      headerRight={
        canReport ? (
          <ReportButton
            tone="light"
            target={{
              reportedId: bottle.authorId,
              contextType: "bottle",
              contextId: bottle.id,
              snapshot: bottle.content,
            }}
          />
        ) : undefined
      }
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alreadyReplied ? (
            <Button display="full" size="xlarge" disabled>
              이미 답장했어요
            </Button>
          ) : (
            <Button
              display="full"
              size="xlarge"
              onClick={() => navigate({ name: "reply", bottleId: bottle.id })}
            >
              💌 답장 쓰기
            </Button>
          )}
          <Button
            display="full"
            size="large"
            variant="weak"
            color="dark"
            onClick={() => navigate({ name: "receive" })}
          >
            받은 편지함으로
          </Button>
        </div>
      }
    >
      {/* 편지지 카드 */}
      <div
        style={{
          ...glassCard,
          marginTop: 8,
          background: ocean.sand,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>{bottleEmoji}</div>
        <Paragraph
          typography="t5"
          color={ocean.ink}
          style={{
            margin: 0,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {bottle.content}
        </Paragraph>

        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px dashed rgba(27,59,111,0.25)",
          }}
        >
          <Paragraph
            typography="t6"
            fontWeight="semibold"
            color={ocean.ink}
            style={{ margin: 0 }}
          >
            {authorLine(bottle)}
          </Paragraph>
          <Paragraph
            typography="t7"
            color={ocean.ink}
            style={{ margin: "4px 0 0", opacity: 0.65 }}
          >
            {formatSentAt(bottle.createdAt)}에 띄운 편지
          </Paragraph>
        </div>
      </div>

      {hasCrisisSignal(bottle.content) && <SupportNotice />}
    </ScreenLayout>
  );
}
