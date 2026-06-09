import { Button, Paragraph, SegmentedControl } from "@toss/tds-mobile";
import { useState } from "react";

import { ScreenLayout } from "../../components/ScreenLayout";
import { useRouter } from "../../router";
import { glassCard, ocean } from "../../theme";
import {
  AGE_BAND_LABEL,
  DEFAULT_FILTER,
  GENDER_LABEL,
  NATIONALITY_LABEL,
  type AgeBand,
  type Filter,
  type FilterValue,
  type Gender,
  type Nationality,
} from "../../types";
import { useFilter } from "./filterStore";

const ANY = "any";

const GENDER_OPTIONS: Array<{ value: FilterValue<Gender>; label: string }> = [
  { value: ANY, label: "상관없음" },
  { value: "male", label: GENDER_LABEL.male },
  { value: "female", label: GENDER_LABEL.female },
];

const AGE_OPTIONS: Array<{ value: FilterValue<AgeBand>; label: string }> = [
  { value: ANY, label: "상관없음" },
  { value: "20s", label: AGE_BAND_LABEL["20s"] },
  { value: "30s", label: AGE_BAND_LABEL["30s"] },
  { value: "40s", label: AGE_BAND_LABEL["40s"] },
  { value: "50s", label: AGE_BAND_LABEL["50s"] },
  { value: "60plus", label: AGE_BAND_LABEL["60plus"] },
];

const NATIONALITY_OPTIONS: Array<{
  value: FilterValue<Nationality>;
  label: string;
}> = [
  { value: ANY, label: "상관없음" },
  { value: "domestic", label: NATIONALITY_LABEL.domestic },
  { value: "foreign", label: NATIONALITY_LABEL.foreign },
];

function Field({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 16 }}>
      <Paragraph
        as="h2"
        typography="t6"
        fontWeight="bold"
        color={ocean.white}
        style={{ margin: "0 0 8px" }}
      >
        {title}
      </Paragraph>
      <div style={{ ...glassCard, padding: 8 }}>{children}</div>
    </section>
  );
}

export function FilterScreen() {
  const { back } = useRouter();
  const { filter, setFilter, reset } = useFilter();

  const [local, setLocal] = useState<Filter>(filter);

  const apply = () => {
    setFilter(local);
    back();
  };

  const resetAll = () => {
    reset();
    setLocal(DEFAULT_FILTER);
  };

  return (
    <ScreenLayout
      title="받을 사람 조건"
      background="sky"
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button display="full" size="xlarge" onClick={apply}>
            적용하기
          </Button>
          <Button
            display="full"
            size="large"
            variant="weak"
            color="dark"
            onClick={resetAll}
          >
            모두 랜덤으로 초기화
          </Button>
        </div>
      }
    >
      <Field title="성별">
        <SegmentedControl
          alignment="fluid"
          value={local.gender}
          onChange={(v) =>
            setLocal((p) => ({ ...p, gender: v as FilterValue<Gender> }))
          }
        >
          {GENDER_OPTIONS.map((o) => (
            <SegmentedControl.Item key={o.value} value={o.value}>
              {o.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
      </Field>

      <Field title="연령대">
        <SegmentedControl
          alignment="fluid"
          value={local.ageBand}
          onChange={(v) =>
            setLocal((p) => ({ ...p, ageBand: v as FilterValue<AgeBand> }))
          }
        >
          {AGE_OPTIONS.map((o) => (
            <SegmentedControl.Item key={o.value} value={o.value}>
              {o.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
      </Field>

      <Field title="국적">
        <SegmentedControl
          alignment="fluid"
          value={local.nationality}
          onChange={(v) =>
            setLocal((p) => ({
              ...p,
              nationality: v as FilterValue<Nationality>,
            }))
          }
        >
          {NATIONALITY_OPTIONS.map((o) => (
            <SegmentedControl.Item key={o.value} value={o.value}>
              {o.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
      </Field>

      <Paragraph
        typography="t7"
        color={ocean.white}
        style={{ margin: "4px 0 0", lineHeight: 1.6, opacity: 0.9 }}
      >
        지정한 조건의 사람들 중 한 명에게 편지가 무작위로 가요. 조건을 지정하면
        편지를 보낼 때 광고를 한 번 보게 돼요. 모두 ‘상관없음’이면 광고 없이 전체
        중 무작위로 보내요.
      </Paragraph>
    </ScreenLayout>
  );
}
