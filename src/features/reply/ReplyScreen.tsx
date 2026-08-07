import { useEffect, useState } from "react";

import { Button, Loader, Paragraph, useDialog, useToast } from "@toss/tds-mobile";

import { ScreenLayout } from "../../components/ScreenLayout";
import { getBottle } from "../../data/bottles";
import { findBannedKeyword, findPersonalInfo } from "../../data/moderation";
import { sendReply } from "../../data/replies";
import { useAdGate } from "../../hooks/useAdGate";
import { EVENT, track } from "../../lib/analytics";
import { useRouter } from "../../router";
import type { Bottle } from "../../types";
import { bottleEmoji, glassCard, ocean } from "../../theme";

const MAX_LENGTH = 1000;

export function ReplyScreen({ bottleId }: { bottleId: string }) {
  const { reset } = useRouter();
  const { openToast } = useToast();
  const { watchThen } = useAdGate();
  const dialog = useDialog();

  const [bottle, setBottle] = useState<Bottle | null>(null);
  const [bottleLoading, setBottleLoading] = useState(true);

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const b = await getBottle(bottleId);
        if (alive) setBottle(b);
      } catch {
        // 원본 편지를 못 불러와도 답장 작성은 계속 가능해요.
      } finally {
        if (alive) setBottleLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [bottleId]);

  const trimmed = content.trim();
  const canSend = trimmed.length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    if (findBannedKeyword(trimmed) != null) {
      openToast(
        "불법 광고 등 부적절한 표현이 포함되어 있어 보낼 수 없어요.",
      );
      return;
    }
    const pi = findPersonalInfo(trimmed);
    if (pi != null) {
      const ok = await dialog.openConfirm({
        title: `${pi}가 포함된 것 같아요`,
        description:
          "안전을 위해 전화번호·계좌·SNS 아이디 같은 개인정보는 빼는 걸 권해요. 그래도 보낼까요?",
        confirmButton: "그래도 보내기",
        cancelButton: "수정할게요",
      });
      if (!ok) return;
    }
    // setSending 은 광고 보상을 받은 뒤에 켜요. 광고 전에 켜면 사용자가 광고를
    // 중간에 닫았을 때 보내기 버튼이 로딩 상태로 굳어 다시 못 보내요.
    watchThen(async () => {
      setSending(true);
      try {
        await sendReply(bottleId, trimmed);
        track(EVENT.replySent, {});
        openToast("답장을 보냈어요. 마음이 잘 닿았을 거예요.");
        reset({ name: "home" });
      } catch {
        openToast("답장을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
        setSending(false);
      }
    }, "reply");
  };

  return (
    <ScreenLayout
      title="답장 쓰기"
      background="sky"
      footer={
        <Button
          size="xlarge"
          display="full"
          loading={sending}
          disabled={!canSend}
          onClick={handleSend}
        >
          📺 광고 보고 답장 보내기
        </Button>
      }
    >
      {/* 원본 편지 미리보기 */}
      <div
        style={{
          ...glassCard,
          marginTop: 8,
          padding: 16,
        }}
      >
        <Paragraph
          typography="t7"
          fontWeight="bold"
          color={ocean.ink}
          style={{ opacity: 0.7, marginBottom: 8 }}
        >
          {bottleEmoji} 받은 편지
        </Paragraph>
        {bottleLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "12px 0",
            }}
          >
            <Loader size="small" />
          </div>
        ) : bottle != null ? (
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
            {bottle.content}
          </Paragraph>
        ) : (
          <Paragraph
            typography="t6"
            color={ocean.ink}
            style={{ margin: 0, lineHeight: 1.6, opacity: 0.6 }}
          >
            원본 편지를 불러오지 못했어요. 그래도 답장은 보낼 수 있어요.
          </Paragraph>
        )}
      </div>

      {/* 답장 입력 카드 */}
      <div
        style={{
          ...glassCard,
          background: ocean.sand,
          marginTop: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
          maxLength={MAX_LENGTH}
          placeholder="답장을 적어보세요..."
          rows={8}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            resize: "none",
            background: "transparent",
            fontSize: 16,
            lineHeight: 1.8,
            color: ocean.ink,
            fontFamily: "inherit",
            backgroundImage:
              "repeating-linear-gradient(transparent, transparent 27px, rgba(27,59,111,0.12) 28px)",
            backgroundAttachment: "local",
          }}
        />
        <Paragraph
          typography="t7"
          color={ocean.ink}
          textAlign="right"
          style={{ marginTop: 10, opacity: 0.6 }}
        >
          {content.length} / {MAX_LENGTH}
        </Paragraph>
      </div>

      <Paragraph
        typography="t7"
        color={ocean.white}
        style={{ margin: "14px 4px 0", lineHeight: 1.5, opacity: 0.85 }}
      >
        답장은 광고 시청 후 전송돼요. 🌊
      </Paragraph>
    </ScreenLayout>
  );
}
