import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "sailboat",
  brand: {
    displayName: "돛단배", // 화면에 노출될 앱의 한글 이름
    primaryColor: "#9575CD", // 앱 기본 색상 (바다/유리병 톤)
    icon: "https://static.toss.im/appsintoss/13203/b1d22d57-56c1-4ccf-8fdf-c1c44fba457a.png", // TODO: 앱 아이콘 이미지 주소
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
  // 토스 네이티브 상단 바: 뒤로가기 버튼 사용 (화면 이동은 graniteEvent.backEvent 로 연결)
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
  },
});
