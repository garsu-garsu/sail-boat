import { useState } from "react";

import { BottomSheet, Button, useToast } from "@toss/tds-mobile";

import { blockUser, reportContent } from "../../data/moderation";
import { EVENT, track } from "../../lib/analytics";
import { ocean } from "../../theme";
import type { ReportTarget } from "../../types";

const REPORT_REASONS = [
  "불법 광고 (조건만남·성매매 등)",
  "욕설·혐오 표현",
  "성적 불쾌감을 주는 내용",
  "사기·스팸",
  "기타 부적절한 내용",
];

interface ReportButtonProps {
  target: ReportTarget;
  /** 트리거 버튼 색 톤 — 어두운 배경 위(light) / 밝은 카드 위(dark) */
  tone?: "light" | "dark";
  /** 차단 버튼 노출 여부 (기본 true) */
  allowBlock?: boolean;
  /** 차단 완료 후 콜백 (예: 채팅에서 뒤로가기) */
  onBlocked?: () => void;
}

/**
 * 편지/답장/채팅을 신고하거나 사용자를 차단하는 버튼.
 * 누르면 바텀시트가 열리고 사유를 고르면 신고가 접수돼요.
 */
export function ReportButton({
  target,
  tone = "dark",
  allowBlock = true,
  onBlocked,
}: ReportButtonProps) {
  const { openToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submitReport = async (reason: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await reportContent(target, reason);
      track(EVENT.reportSubmitted, { type: target.contextType });
      openToast("신고가 접수됐어요. 24시간 이내에 확인할게요.");
      setOpen(false);
    } catch {
      openToast("신고를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const doBlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await blockUser(target.reportedId);
      openToast("차단했어요. 더 이상 이 사용자와 편지를 주고받지 않아요.");
      setOpen(false);
      onBlocked?.();
    } catch {
      openToast("차단하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="신고하기"
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          padding: "4px 6px",
          color: tone === "light" ? ocean.white : ocean.ink,
          opacity: 0.85,
        }}
      >
        🚩 신고
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        header={<BottomSheet.Header>신고 및 차단</BottomSheet.Header>}
        headerDescription={
          <BottomSheet.HeaderDescription>
            부적절한 내용을 신고하면 24시간 이내에 확인해요. 신고 사유를
            선택해 주세요.
          </BottomSheet.HeaderDescription>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "8px 24px 12px",
          }}
        >
          {REPORT_REASONS.map((reason) => (
            <Button
              key={reason}
              display="full"
              size="large"
              variant="weak"
              color="dark"
              disabled={busy}
              onClick={() => void submitReport(reason)}
            >
              {reason}
            </Button>
          ))}

          {allowBlock && (
            <Button
              display="full"
              size="large"
              variant="weak"
              color="danger"
              disabled={busy}
              onClick={() => void doBlock()}
            >
              이 사용자 차단하기
            </Button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
