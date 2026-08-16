#!/usr/bin/env node
// miniprogram-ci 上传脚本 —— 不依赖 IDE/登录态
// 用法: node scripts/upload-ci.js "版本号" "备注"
// 前提: 上传密钥文件在 scripts/miniprogram-ci-key/{appid}.key
const fs = require("fs");
const path = require("path");
const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const ci = require("miniprogram-ci");
const appid = env.WX_APPID || "wxe4ab72773abd200f";
const keyPath = path.join(__dirname, "miniprogram-ci-key", appid + ".key");
if (!fs.existsSync(keyPath)) {
  console.error("缺少上传密钥文件: " + keyPath);
  console.error("去 mp.weixin.qq.com -> 开发管理 -> 开发设置 -> 代码上传 生成密钥, 把 .key 改名为 " + appid + ".key 放入该目录");
  process.exit(1);
}
const version = process.argv[2] || "1.0." + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "x";
const desc = process.argv[3] || "auto upload " + new Date().toLocaleString("zh-CN");
(async () => {
  const project = new ci.Project({
    appid,
    type: "miniProgram",
    projectPath: path.join(__dirname, ".."),
    privateKeyPath: keyPath,
    ignores: ["node_modules/**/*", "tests/**/*", "scripts/**/*", "output/**/*", "screenshots/**/*", "logs/**/*", "cloudfunctions/**/*", ".git/**/*", "**/*.md", "package-lock.json", "package.json", ".env", "project.private.config.json"],
  });
  console.log("uploading:", JSON.stringify({ version, desc, appid }));
  const res = await ci.upload({ project, version, desc, setting: { es6: true, minify: true, autoPrefixWXSS: true } });
  console.log("UPLOAD_OK:", JSON.stringify(res));
})().catch((e) => { console.error("UPLOAD_FAIL:", e.message || e); process.exit(1); });
