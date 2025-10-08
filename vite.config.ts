import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    webExtension({
      // manifest は既存のものを使用
      manifest: "./manifest.json",
      // 出力先ディレクトリ
      // build するとこのディレクトリに出力される
      // デフォルトは 'dist'
      outDir: "dist",
      // 静的アセット (manifest.json や webAccessibleResources で参照されるもの) を出力ディレクトリにコピー
      copyPublicAssets: true,
    }),
  ],
});