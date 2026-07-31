
## v2.0-alpha3 — 2026-07-31（procurement + fuel 佈線完成）

### procurement.html（採購中心）— 保留原邏輯，外科手術式修補
**核可流程完全不動**：Nin→Phea→Paul 三段、庫存安全水位、收貨/領用、PO history 全保留。
- 🔐 **安全修正**：移除前端寫死 PIN（1111/2222/2026）；移除 `?role=&name=` URL 直接登入
- 登入改為輸入 Telegram ID 向 GAS 換發 session token（含效期+簽章，權限後端 APPROVERS 驗證）
- Telegram `/exp` 點入自動帶 uid 換 session 免登入；登出清除 session
- POST 由 `application/json` 改 `text/plain;charset=utf-8`（避免 CORS preflight）
- ➕ 柬文按鈕；➕ 頁首共用工具列（雲端上/下載狀態、智慧匯入、Telegram）
- ➕ 分析頁：狀態圓餅／分類金額／月度趨勢／低庫存 Top ＋ KPI ＋ 明細表，走統一日/週/月/年
- Telegram 摘要與核可分離（canApprove:true）；智慧匯入僅具權限者可「匯入並送核可」，
  其餘只匯草稿——不因匯入自動核可

### fuel.html（燃油中心）— 補齊頁首與摘要
原已具三語、四種 Excel 自動解析、多圖表、日/週/月/年。
- ➕ 雲端上/下載圖示移至頁首（六態狀態燈）；➕ 智慧匯入、Telegram 按鈕
- Telegram 改用共用摘要 modal：可選期間/語言/群組
- 摘要含效率分析 L/100km、km/L、叉車 L/hr、發電機 L/hr；分母為 0 顯示「資料不足」不出 Infinity
- 燃油 Excel 維持原多表解析器（Paul 既有格式），不強迫走通用匯入

### 待辦（下一階段）
- index / receiving / maintenance 佈線
- 庫存**結轉邏輯**（餘數延續下月）：待專門討論——採「建議值＋盤點斷點＋可覆蓋」避免漏填錯誤累積；
  未填使用量顯示「未盤點」而非當 0
- README / TEST_CHECKLIST 更新、AC_GA_EXP_Import_Template.xlsx

## v2.0-alpha4 — 2026-07-31（receiving 佈線完成）

### receiving.html（收貨報告）
- 📅 期間導覽改用共用 GA 引擎：**新增 Day 模式**、**週一起算**（原本週日起算已修正），
  順序統一為日/週/月/年；切語言時期間標籤同步更新
- 📊 分析圖表（分類/Top10/部門）改為**依目前所選期間過濾**（原本吃全部資料）
- 🗑️ **刪除收發記錄時正確反沖庫存**（原本只刪記錄不還原）：
  刪收貨→扣回庫存與 ytdPurchased；刪領用→加回庫存、扣回 ytdUsed
- ☁️ **雲端不再需要手填**：設定頁移除 GAS URL / Bot Token / Chat ID 三個欄位，
  一律沿用平台設定中心（ac_ga_exp_config），並顯示目前 GAS 狀態；
  按鈕連到平台設定中心
- ☁️ 頁首雲端區：新增六態狀態燈 ＋ 明確的 ⬆️ 上傳 / ⬇️ 下載圖示（原本 ☁️/📥 不夠直覺）
- ✈️ Telegram 改用共用摘要 modal：可選期間/語言/群組/範圍（收貨/領用/全部），
  摘要含部門 top、低庫存明細；不需手填 token（一律經 GAS）
- 📥 新增智慧匯入：多檔多格式自動辨識收貨/品項，去重、更新庫存
- 動態表頭（收/用）三語化
- Telegram Bot Token 不再落地瀏覽器

### 待辦
- index.html（**改淡色系** ← 用戶指定）
- maintenance.html
- README / TEST_CHECKLIST、xlsx 範本
- 庫存結轉邏輯（另議）
