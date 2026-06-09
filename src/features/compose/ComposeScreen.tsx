import { useEffect, useState } from "react";

import { Button, Paragraph, useDialog, useToast } from "@toss/tds-mobile";

import { ScreenLayout } from "../../components/ScreenLayout";
import { getSendQuota, sendBottle } from "../../data/bottles";
import {
  findBannedKeyword,
  findPersonalInfo,
  hasCrisisSignal,
} from "../../data/moderation";
import { shareApp } from "../../data/share";
import { EVENT, track } from "../../lib/analytics";
import { SupportNotice } from "../safety/SupportNotice";
import { useAdGate } from "../../hooks/useAdGate";
import { useRouter } from "../../router";
import { useSession } from "../../session";
import { bottleEmoji, glassCard, ocean } from "../../theme";
import {
  AGE_BAND_LABEL,
  DEFAULT_FILTER,
  GENDER_LABEL,
  NATIONALITY_LABEL,
  isFilterActive,
  type Filter,
  type SendQuota,
} from "../../types";
import { useFilter } from "../filter/filterStore";

const MAX_LENGTH = 1000;

/** 활성 필터를 사람이 읽는 칩 라벨 배열로 */
function filterLabels(filter: Filter): string[] {
  const labels: string[] = [];
  if (filter.gender !== "any") labels.push(GENDER_LABEL[filter.gender]);
  if (filter.ageBand !== "any") labels.push(AGE_BAND_LABEL[filter.ageBand]);
  if (filter.nationality !== "any")
    labels.push(NATIONALITY_LABEL[filter.nationality]);
  return labels;
}

export function ComposeScreen() {
  const { navigate } = useRouter();
  const { profile } = useSession();
  const { filter } = useFilter();
  const { watchThen } = useAdGate();
  const { openToast } = useToast();
  const dialog = useDialog();

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<SendQuota | null>(null);

  // 오늘 발송 횟수/한도 조회
  useEffect(() => {
    if (profile == null) return;
    let alive = true;
    void getSendQuota()
      .then((q) => {
        if (alive) setQuota(q);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile]);

  // 로그인 전: 작성 UI 숨기고 안내만 보여줘요.
  if (profile == null) {
    return (
      <ScreenLayout title="편지 쓰기" background="sky">
        <div
          style={{
            ...glassCard,
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1 }}>✉️</div>
          <Paragraph
            typography="t6"
            color={ocean.ink}
            style={{ margin: 0, lineHeight: 1.6 }}
          >
            편지를 보내려면 먼저 시작해 주세요.
          </Paragraph>
          <Button
            size="xlarge"
            display="full"
            onClick={() => navigate({ name: "onboarding" })}
          >
            시작하기
          </Button>
        </div>
      </ScreenLayout>
    );
  }

  const trimmed = content.trim();
  const active = isFilterActive(filter);
  const activeLabels = filterLabels(filter);
  // 발송 구간: 무료(<free) → 광고(<daily) → 공유+광고(<share) → 차단(>=share)
  const blocked = quota != null && quota.sentToday >= quota.shareLimit;
  const needsShare =
    quota != null &&
    quota.sentToday >= quota.dailyLimit &&
    quota.sentToday < quota.shareLimit;
  const needsAd =
    !needsShare &&
    (active || (quota != null && quota.sentToday >= quota.freeLimit));
  const canSend = trimmed.length > 0 && !loading && !blocked;

  const remainingFree =
    quota != null ? Math.max(0, quota.freeLimit - quota.sentToday) : 0;
  const quotaText =
    quota == null
      ? ""
      : blocked
        ? `오늘 한도(${quota.shareLimit}건)를 다 보냈어요. 내일 자정에 다시 채워져요.`
        : needsShare
          ? `무료·광고 발송을 다 썼어요. 공유하면 한 통 더 보낼 수 있어요 · 오늘 ${quota.sentToday}/${quota.shareLimit}건`
          : remainingFree > 0
            ? `오늘 무료 ${remainingFree}건 남았어요 · 하루 최대 ${quota.shareLimit}건`
            : `무료 발송을 다 썼어요. 광고를 보고 보낼 수 있어요 · 오늘 ${quota.sentToday}/${quota.dailyLimit}건`;

  // sendFilter 로 보내요. 조건이 있는데 받을 사람이 0명이면
  // "조건 없이 보내기"를 제안하고, 수락하면 조건을 빼고 다시 보내요.
  const doSend = async (sendFilter: Filter = filter) => {
    setLoading(true);
    try {
      const filtered = isFilterActive(sendFilter);
      const b = await sendBottle(trimmed, sendFilter);
      if (b == null) {
        track(EVENT.noRecipient, { has_filter: filtered });
        if (filtered) {
          const ok = await dialog.openConfirm({
            title: "아직 조건에 맞는 사람이 없어요",
            description: "조건을 빼고 전체 사용자 중 한 명에게 보낼까요?",
            confirmButton: "조건 없이 보내기",
            cancelButton: "다음에",
          });
          if (ok) await doSend(DEFAULT_FILTER);
        } else {
          openToast("아직 받을 사람이 없어요. 잠시 후 다시 시도해 주세요.");
        }
        return;
      }
      track(EVENT.bottleSent, {
        zone: needsShare ? "share" : needsAd ? "ad" : "free",
        has_filter: filtered,
        fallback: active && !filtered,
      });
      navigate({ name: "floated" });
    } catch {
      openToast("편지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    if (findBannedKeyword(trimmed) != null) {
      openToast("불법 광고 등 부적절한 표현이 포함되어 있어 보낼 수 없어요.");
      return;
    }
    // 개인정보·연락처가 보이면 보내기 전에 한 번 더 확인 (soft 경고)
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
    // 광고 한도(10건)까지 다 썼으면 공유부터 하고, 그다음 광고 → 발송
    if (needsShare) {
      setLoading(true);
      const shared = await shareApp();
      setLoading(false);
      if (!shared) {
        openToast("공유를 완료하면 한 통 더 보낼 수 있어요.");
        return;
      }
      track(EVENT.shareCompleted, { context: "send" });
      watchThen(() => void doSend(), "send");
      return;
    }
    if (needsAd) {
      watchThen(() => void doSend(), "send");
      return;
    }
    void doSend();
  };

  return (
    <ScreenLayout
      title="편지 쓰기"
      background="sky"
      footer={
        <Button
          size="xlarge"
          display="full"
          loading={loading}
          disabled={!canSend}
          onClick={handleSend}
        >
          {blocked
            ? "오늘 다 보냈어요"
            : needsShare
              ? "🔗 공유하고 한 통 더 보내기"
              : needsAd
                ? "📺 광고 보고 보내기"
                : `${bottleEmoji} 편지 보내기`}
        </Button>
      }
    >
      {/* 받을 대상(타겟) 조건 카드 */}
      <div style={{ ...glassCard, marginTop: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: active ? 10 : 0,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {active ? (
              activeLabels.map((label) => (
                <Paragraph
                  key={label}
                  display="inline"
                  typography="t7"
                  fontWeight="semibold"
                  color={ocean.white}
                  style={{
                    background: ocean.primary,
                    borderRadius: 999,
                    padding: "5px 12px",
                  }}
                >
                  {label}
                </Paragraph>
              ))
            ) : (
              <Paragraph
                display="inline"
                typography="t6"
                fontWeight="semibold"
                color={ocean.ink}
              >
                아무에게나 (랜덤)
              </Paragraph>
            )}
          </div>
          <Button
            size="small"
            variant="weak"
            color="dark"
            onClick={() => navigate({ name: "filter" })}
          >
            받을 사람 설정
          </Button>
        </div>
        <Paragraph
          typography="t7"
          color={ocean.ink}
          style={{ margin: 0, lineHeight: 1.5, opacity: 0.75 }}
        >
          {active
            ? "지정한 조건의 사람 중 한 명에게 무작위로 가요. 보낼 때 광고를 한 번 봐요."
            : "전체 사용자 중 한 명에게 무작위로 가요."}
        </Paragraph>
        {quotaText !== "" && (
          <Paragraph
            typography="t7"
            fontWeight="semibold"
            color={blocked ? ocean.ink : ocean.primary}
            style={{ margin: "10px 0 0" }}
          >
            {quotaText}
          </Paragraph>
        )}
      </div>

      {/* 편지지 카드 */}
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
          placeholder="바다 건너 누군가에게 전할 마음을 적어보세요..."
          rows={11}
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
        한 번 보낸 편지는 되돌릴 수 없어요. 따뜻한 마음을 담아 보내주세요. 🌊
      </Paragraph>

      {hasCrisisSignal(content) && <SupportNotice />}
    </ScreenLayout>
  );
}
