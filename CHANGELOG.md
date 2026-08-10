
## v2.3-fix10 — 2026-08-10（核可 Dashboard 與維修／臨採雲端工具列）

- 維修／臨採核可結果統一重新組合 Dashboard，並附平台網址；避免核可後訊息只剩狀態與核可人。
- maintenance 頁首新增雲端狀態、上傳、下載圖示；新增 `MAINTENANCE_DB` 分塊雲端備份，下載採合併方式避免少資料覆蓋多資料。
- 維修／臨採送出的正式紀錄仍寫入 `Repair_Records`／`Temp_PO`，雲端工具列另保存查詢結果與智慧匯入草稿。

## v2.3-fix9 — 2026-08-09（AC-GA-EXP 工具列入口統一）

- 採購、收貨、維修、燃油、費用保留原有資料與核可流程，將雲端、Telegram、智慧匯入／資料管理集中在頁首工具列。
- 收貨移除舊式 Excel 匯入的第二入口；費用新增表單移除重複上傳；燃油設定頁移除第二組雲端／Telegram 發送按鈕。
- 燃油設定頁保留 GAS URL，Telegram 改由頁首共用摘要視窗選擇期間、語言與群組。

## v2.3-fix8 — 2026-08-09（補充每月檢查手動測試入口）

- 新增無參數的 `testMonthlyCompletenessCheck()`，可直接在 Apps Script 執行器測試上月報告。
- 修正操作說明：Apps Script 執行器不能直接傳入 `monthlyCompletenessCheck(true)` 的參數。

## v2.3-fix7 — 2026-08-09（每月 5 日資料完整性檢查）

- 新增 `monthlyCompletenessCheck()`：每月 5 日檢查上個月採購、臨採、維修、收貨／領用、柴油、費用。
- 分別判斷是否已上傳雲端、是否已發摘要或送核可；「已發但未上傳」會明確列為需處理。
- 通知固定使用中文／English／ខ្មែរ，一個月份只發一次，並納入平台 Dashboard。
- 新增 `MONTHLY_ACTIVITY` 紀錄表，保留活動時間而不重複保存業務資料；兼容既有雲端資料。
- `setupPolling()` 重新執行時會同步建立每月 5 日排程。

## v2.3-fix6 — 2026-08-08（摘要／核可訊息統一附 Dashboard）

- 所有 Telegram 摘要底部統一附「平台概況 Dashboard」：總覽、採購、臨採、維修、收貨、柴油、費用，以及各模組頁面送出的摘要。
- 所有核可請求與核可結果均保留 Dashboard：送出、審查通過、核可、退回、拒絕、維修／臨採核可，以及核可文件與 CSV 通知。
- 更新既有訊息時會先移除舊 Dashboard 再重建，避免重複堆疊；Dashboard 內容以中英雙語顯示。
- 保留前一版的繁中／English／ខ្មែរ介面修正與維修、燃油、費用、收貨的檢查人欄位及資料相容層。

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

## v2.0-alpha5 — 2026-07-31（maintenance 佈線完成）

### maintenance.html（維修中心）
**核可流程完全不動**：維修/臨採提交時仍走原有 Telegram inline 按鈕核可（含現場照片經 GAS 轉發）。
- ☁️ 頁首新增雲端六態狀態燈；➕ 智慧匯入、Telegram 摘要按鈕
- 📅 維修記錄／採購記錄兩個查詢分頁各加**期間導覽**（日/週/月/年、週一起算）：
  查詢後可用期間列即時過濾，統計 KPI 與明細表同步更新
- 📊 每個記錄分頁加**分析圖**（狀態圓餅 + 部門長條），依目前期間過濾
- ✈️ Telegram 摘要與核可分離：`canApprove:false`，摘要可選維修/臨採範圍、期間、語言、群組；
  含已核可/待審/退件/緊急統計與部門 top；不帶核可按鈕、不改狀態
- 📥 智慧匯入：維修/臨採 Excel 解析為草稿（不自動送核可，維持核可權限流程）
- 記錄查詢改用 GA.gasGet（統一信封、GAS 錯誤頁友善提示）
- Excel 匯出改為匯出目前期間過濾後的資料
- 語言與平台預設同步

### 待辦
- index.html（**改淡色系** + Dashboard 接數據）← 最後收尾
- README / TEST_CHECKLIST、xlsx 範本
- 庫存結轉邏輯（另議）

## v2.0-alpha6 — 2026-07-31（index 淡色 + 兩個 bug 修正 + 交接文件）

### index.html — 全新淡色系（用戶指定）
- 深黑底（#0d0f14）改為與其他模組一致的淺色（沿用 shared/ga.css 變數）
- Dashboard 六格 KPI 可點擊直接進對應模組
- 設定中心／群組管理改用 GA 統一客戶端與 modal 樣式
- 三語切換、雲端六態狀態燈

### 🐞 Bug 修正
1. **自訂品項無法選取（procurement）**
   樣板字串 `chQ(${item.id},-1)` 未加引號 → 字串 id（自訂品項）被當 JS 變數名 →
   ReferenceError → 數量按鈕失效、卡片不變色、無法送核。
   已全面修正為 `chQ('${item.id}',-1)`（含 setQ/setN/openUnitEdit 等 7 處）
2. **登入方式改回密碼（依用戶要求）**
   - Applicant 1111 / Review 2222 / Manager 2026
   - **Paul（Owner）需 Telegram ID + 密碼雙重驗證**，他人無法進入核可
   - Owner 同時具申請與核可權限（可送核、可核可）
   - 實測：錯 ID 擋下、錯密碼擋下、雙對放行

### 📄 新增 系統架構與交接_HANDOVER.md
供新對話窗接手用：架構、共用 API、不可破壞規則、進度、異常處理、開場建議

### ⏳ 待辦（已寫入交接文件第八節）
- 摘要底部加 Dashboard
- 群組核可完成後產生可下載文件
- 異常報告推送
- 庫存結轉邏輯（另議）
- README / TEST_CHECKLIST、xlsx 範本

## v2.0-alpha7 — 2026-07-31（單獨開檔修正 + 加深淡色）

### 🐞 修正「GA is not defined」與「看起來沒框沒底」
根因：單獨開一個 HTML 檔（下載後直接開／App 預覽）時，找不到旁邊的 shared/ 資料夾，
導致 ga.css（樣式）與 ga-core.js（功能）都沒載入 →「GA is not defined」、姓名下拉空白、
採購進不去、畫面沒框沒底看起來很淡。

修正：
- 所有 6 個 HTML 加入**自動補救**：若相對路徑的 shared/ 載入失敗，
  自動改從 GitHub 絕對網址（saintdou-weng.github.io/ac-ga-exp/shared/）補載
  - CSS 用 `<link onerror>` 切換
  - JS 用 `typeof GA==="undefined"` 偵測後 document.write 絕對網址
  - 實測：單獨開檔時會自動去 GitHub 補載 ga-core.js
- **前提**：shared/ 資料夾至少要上傳到 GitHub 一次，補救才抓得到

### 🎨 加深淡色（用戶反映太淡看不到框跟字）
- ga.css 邊框 #e2e8f0 → #cbd5e1；次要文字 #475569 → #334155；提示色 #94a3b8 → #64748b
- 主色加深一階（sky #0284c7→#0369a1 等），對比更明顯
- index KPI 卡與模組卡邊框 1px → 1.5px，左側色條 3px → 4px，標籤字加粗

## v2.1 — 2026-07-31（三大平台功能 + 文件收尾）

### 三大功能（Paul 要求）
1. **摘要底部附 Dashboard**：`handleTgSummary` 每則摘要底部自動附平台六大概況
   （採購/臨採/維修/收貨/柴油/費用），`buildDashboardBlock()`
2. **核可完成產生可下載文件**：`handleBatchCallback` 核可通過後 `generateApprovalDoc()`
   建 Google Sheet（知連結可讀），回貼 Excel/PDF/線上檢視三個連結到 Telegram 訊息
3. **異常報告**：`computeAnomalies()` 檢查低庫存、超預算、逾期未核(>3天)、
   油耗異常(>30 L/100km)；`/anomaly` `/dashboard` 指令、index「⚠️ 異常」鈕、
   `anomalyReport` action 觸發推送
- `handleDashboard` 拆出可重用的 `computeDashboard()`，並支援 expense v2（逐筆 txns）
- 需 Drive 權限（產生文件），initPlatformV2 首次授權時一併允許

### 文件收尾
- README.md 更新（部署、登入、指令、三大功能、FAQ）
- TEST_CHECKLIST.md（逐項測試清單）
- AC_GA_EXP_Import_Template.xlsx（智慧匯入範本，含說明頁與五模組範例）
- 交接文件標記前三項完成

## v2.2 — 2026-08-05（VRT 真實 Excel 格式解析 + 維修專屬分析）

### 🐞 修正：expense 讀不到 General Expense / Purchase Report
根因：這些檔案的格式通用解析器讀不到——
表頭不在第 1 列、日期是 Excel serial、月份/類別分頁的寬表、
同分頁左右並排多區塊、部分金額欄是瑞爾不是美金。

新增 `shared/ga-vrt-parsers.js`，針對 Paul 實際檔案寫專用解析器並註冊進智慧匯入：
| 來源 | 解析結果（實測對照原檔） |
|---|---|
| Purchasing_Record › `purchase ` | 17 筆，合計 **$1,228.90**（與原檔 TTL 一致）|
| other_repair-expenses › `expenses` | 152 筆，合計 **$4,466.10**（與原檔 TTL 一致）|
| Repair-Maintainance › `Forklift` | 26 筆，$1,370（左右兩台並排、月份向下填滿）|
| General_Expense › 類別分頁 | Electric 30 筆，2024-01 = $4,445.38 |
| General_Expense › 月份分頁 | Jan 6 筆，Clinic 357.6 / Security 840+1960 等 |

處理要點：
- **幣別**：Amount(R) 是瑞爾，右側標 `$` 的才是美金 → 自動取美金欄，
  避免把 510,270 R 當成美金加總
- **負數列**：來源檔某月「New 讀數」未填時公式算出負值 → 跳過並記錄原因，
  可查 `GA.vrtParsers.skipped`
- **WATER 瑞爾金額**：標記 `需確認匯率`，不直接當美金計入
- Excel serial 日期正確轉換（46059 → 2026-02-06）
- ⚠️ `.xlsb` 在瀏覽器端 SheetJS 支援有限，若讀不到請先另存 `.xlsx`

### 🔧 維修分析改為專屬視角（原本與臨採同格式）
維修記錄分頁不再只有「狀態＋部門」，改為維修真正關心的四張圖：
1. **設備故障排行** — 什麼設備最常壞
2. **緊急程度分布** — 緊急/重大/一般
3. **地點分布** — 哪裡最常出問題
4. **維修成本 Top** — 哪台設備最花錢
另加三個 KPI：維修總成本、平均每筆、重複故障設備數。
臨採分頁維持原本的狀態＋部門（採購關心誰在買），兩者視角分開。

## v2.3 — 2026-08-07（摘要大幅細化 + 未來日期異常 + 資料管理）

### 🚨 未來日期異常（Paul 在群組實際踩到：8月卻收到9月柴油摘要）
- `GA.isFuture()` / `GA.futureRecords()` / `GA.futureWarnText()`
- 所有摘要底部自動列出「日期超過今天」的記錄要求確認
- `/anomaly` 異常報告新增「📅 日期超過今天」分類（柴油/收發/費用全掃）
- 實測：2026-09-15 記錄在 8/7 會被標為異常

### 摘要細化（原本太簡略）
- **柴油**：新增範圍選擇（全部/司機/叉車/發電機）；列出**各車 km/L/效率**、
  **發電機每日用量**、**各叉車 L/hr**
- **費用**：預設列出**全部類別**（原本只前 5）含占比％；新增超預算類別提醒；
  範圍可選 全部/前十大/依來源
- **收貨**：列出**全部部門**領用量、領用品項 Top 12、收貨品項 Top 10、
  低庫存明細 15 筆（含 stock/min）
- 全部維持日/週/月/年可選

### 🗂️ 資料管理（新增 shared/ga-data.js）
每個模組頁首新增 🗂️ 鈕：
- 匯出 Excel、匯出 JSON 備份（含完整資料，可跨裝置還原）
- 匯入備份，可選**合併**（保留現有、自動去重）或**覆蓋**
- 清空全部資料（需輸入 DELETE 二次確認）
- 已接上 fuel / receiving / expense
## v2.3-fixed — 2026-08-08（語言、Telegram 異常推送與未來日期警示修正）

### 共用語言
- 三語改由 `GA.lang` 與 `ac_ga_exp_lang` 統一保存，舊燃油語言鍵同步保留，避免不同頁面啟動時互相覆蓋。
- receiving、maintenance、fuel、procurement 都監聽共用 `lang` 事件；切換後頁面內容與按鈕狀態同步更新。

### Telegram／異常報告
- Telegram polling 加入 Script Lock，並用單一 offset 流程去重，避免同一 update 被兩個時間觸發器重複處理。
- `/anomaly`、`/abnomaly`、`/abnormaly`、`/alert` 改為完整指令比對；同一異常內容對同一群組 2 分鐘內不重複發送。
- 群組 Chat ID 自動去重；新增管理員指令 `/stopanomaly`、`/startanomaly`。

### 摘要錯誤
- fuel、receiving、expense 對 `GA.futureWarnText` 加安全檢查，避免舊版核心載入時把 `GA.futureWarnText is not a function` 當成 Telegram 摘要送出。
## v2.0-alpha5 — 2026-08-08（Fuel 三語切換修正）

### fuel.html（燃油中心）— 統一語言更新路徑
- 修正分頁路由誤用 `data-t` 導致共用翻譯核心把 `upload / daily / monthly` 直接顯示在畫面上的問題；路由改用 `data-tab`。
- 分頁、月報／年報按鈕、表格標題、篩選器、雲端設定、Telegram 設定及狀態訊息統一使用中／英／柬三語字典。
- 切換語言後會重新繪製目前分頁，避免標題已切換但表格仍停留在上一種語言。
- 平台首頁的燃油入口加入版本查詢參數，避免瀏覽器繼續使用舊版快取。
## v2.0-alpha6 — 2026-08-08（四模組加入檢查人）

- 維修、燃油、費用、收貨新增 `inspector`（檢查人）欄位。
- 新增/編輯表單、列表、Excel 匯出及 Telegram 日／週／月／年摘要均顯示檢查人；未填會明確標示。
- 維修 GAS 試算表將檢查人追加在最後一欄，兼容既有 16 欄資料，不影響狀態與核可欄位。
