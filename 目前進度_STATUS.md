# AC-GA-EXP v2 目前進度

## ✅ 已佈線完成（可直接部署使用）
| 檔案 | 狀態 |
|---|---|
| shared/ga-core.js | 共用引擎：三語 i18n、日/週/月/年期間列（週一起算）、雲端六態、表格、圖表、安全除法 |
| shared/ga-import.js | 智慧匯入：多檔多表自動辨識、去重、預覽 |
| shared/ga-telegram.js | Telegram 摘要／核可分離 modal |
| shared/ga.css | 統一淺色緊湊樣式 |
| shared/exp-seed.js | expense 硬寫資料遷移（201 筆歷史交易，總額已核對） |
| AC_GA_EXP.gs | 後端 v2：權限、Session、核可批次、摘要分離、稽核 |
| **expense.html** | ✅ 全新逐筆交易帳＋期間＋三語＋圖表＋Telegram＋智慧匯入 |
| **procurement.html** | ✅ 移除 PIN/URL登入漏洞、session登入、分析頁、工具列、柬文（核可流程不變） |
| **fuel.html** | ✅ 頁首雲端圖示、Telegram 摘要（含 L/100km 效率）、智慧匯入入口 |

## ⏳ 尚未佈線（仍為 v1 狀態，可正常運作但無新統一介面）
- index.html
- receiving.html
- maintenance.html

## 📌 待討論
- **庫存結轉邏輯**：餘數延續下月當基數。
  建議做法：系統算「理論結存」當下月開帳**預設值但可手動改**，
  加「盤點斷點」以實際盤點月為準往後算，避免某月漏填使用量造成錯誤累積。
  未填使用量顯示「⚠️ 未盤點」而非當 0，讓月報看得出哪些數字可信。
  → 需改動庫存資料結構，之後專門開一輪處理。

## 部署提醒
1. AC_GA_EXP.gs 貼上後執行 initPlatformV2() 建表
2. 部署時用「管理部署→編輯現有部署→新版本」，勿建新部署（網址會變）
3. 部署後務必重跑 setupPolling()（每次重新部署都要）
4. shared/ 資料夾要完整上傳到 GitHub repo（大小寫需正確）
