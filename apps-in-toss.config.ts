import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "sailboat",
  brand: {
    primaryColor: "#9575CD", // 앱 기본 색상 (바다/유리병 톤)
  },
  permissions: [],
  webBundleDir: "dist",
  // 토스 네이티브 상단 바: 뒤로가기 버튼 사용 (화면 이동은 graniteEvent.backEvent 로 연결)
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
  },
});
