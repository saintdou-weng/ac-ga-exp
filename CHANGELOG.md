# AC-GA-EXP CHANGELOG

## v2.0-alpha1 — 2026-07-31（基礎層）

### 新增檔案
- `shared/ga-core.js` — 設定、GAS 客戶端（統一信封）、三語 i18n、本地日期、
  期間控制（日/週/月/年，週一起算）、雲端六態指示器、表格（排序/搜尋/分頁）、
  圖表登錄（destroy 後重建）、狀態代碼正規化、canonical record 戳記、安全除法
- `shared/ga-import.js` — 智慧匯入：多檔多工作表自動辨識、表頭別名對應、
  合計/簽核列略過、Excel serial date 時區安全、指紋去重、預覽與欄位配對 UI
- `shared/ga-telegram.js` — Telegram 摘要／核可完全分離的視窗與送出邏輯
- `shared/ga.css` — Onboarding 淺色緊湊樣式；桌機圖示＋文字、手機純圖示

### AC_GA_EXP.gs（補齊 ZIP 缺件並升級 v2）
- **統一回應信封** `{ok,data,error,code,ts,revision}`；新增 `jsonErr()`
- **伺服器端權限**：新增 `APPROVERS` 工作表為權限唯一真實來源；
  `canDo()` 依角色矩陣驗證；Owner Telegram ID `5026942575` 預先寫入
- **Session token**：GAS 簽發、含效期（12h）與 SHA-256 簽章，
  取代 `?role=`/`?name=` 登入
- **摘要與核可分離**：
  - `tgSummary` — 純通知，`newGroupMsg(cid, html, null)` 永無按鈕，不改狀態
  - `tgApproval` — 建立批次、帶原有核可按鈕、`idempotencyKey` 重送更新原訊息、
    已關閉批次拒絕重送
- **`handleBatchCallback`** — 以 `callback_query.from.id` 驗證權限，
  `LockService` 防併發，全程寫入 `AUDIT_LOG`
- 新增工作表：`APPROVERS`、`APPROVAL_BATCHES`、`AUDIT_LOG`、`IMPORT_LOG`、`SOURCE_LINKS`
- 新增 action：`whoami`、`approvers`、`batchList`、`issueSession`
- 新增 `initPlatformV2()`

### 安全修正（已驗證）
- **移除 fuel.html 與 receiving.html 的 `api.telegram.org` 直連**
  → 全部改走 GAS `tgSummary`；全專案已無任何前端 Telegram 直連
- **移除 `vrt_dsl_tg_token`** localStorage 保存
- 全部 HTML 的 GAS URL 更新為新部署網址

### 相容性
- 所有既有 action 保留：`ping` `dashboard` `getGroups` `saveGroups` `notify`
  `getState` `saveState` `getInventory` `saveInventory` `getHistory` `submit`
  `voidPO` `repairHistory` `tempHistory` `repairSubmit` `tempSubmit`
  `exportRecords` `recvLoad` `recvSave` `dieselLoad` `dieselSave`
  `expenseLoad` `expenseSave` `all`
- Bot 指令保留：`/order` `/po` `/purchase` `/repair` `/status` `/help` `/exp`
- `GA.normStatus()` 將舊資料的「已核可 / Approved / 待審核」統一為代碼

### 尚未完成（下一階段）
各模組頁面尚未接上共用元件的 UI 佈線：頁首工具列、期間控制列、
分析圖表、三語標記、Expense 硬寫資料遷移。程式庫已就緒，屬佈線工作。
