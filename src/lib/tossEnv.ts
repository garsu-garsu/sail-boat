/**
 * 토스 앱(WebView) 안에서 실행 중인지 여부.
 *
 * 토스 미니앱은 React Native WebView 안에서 열리며, 이때 `window.ReactNativeWebView` 가 주입돼요.
 * 일반 브라우저(둘러보기 개발)에는 없으므로 이걸로 환경을 구분해요.
 *
 * 토스 안에서는 네이티브 상단 바가 뒤로가기를 제공하므로 인앱 back 버튼을 숨기고,
 * 브라우저에서는 네이티브 바가 없어 인앱 back 버튼을 폴백으로 보여줘요.
 */
export function isInTossApp(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView !=
      null
  );
}
