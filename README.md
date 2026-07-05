# AC-GA-EXP Platform · 部署說明

**Admin Center - General Affairs & Expense Management Platform**
Repo: `saintdou-weng/ac-ga-exp` · GAS: `AC_GA_EXP` · Sheet: `AC_GA_EXP_DB` · Bot: `@acgaexp_bot` · 預設群組: `-5271842001`

## 一、檔案清單（全部放 Repo 根目錄）

| 檔案 | 模組 | 說明 |
|---|---|---|
| index.html | 首頁 Dashboard + 設定中心 | KPI 彙總、模組入口、GAS URL／語言／Telegram 群組管理 |
| procurement.html | 採購中心 | 原 ga_po_v2（月度 PO + 庫存 + 收貨紀錄 + 三段審批） |
| receiving.html | 收貨報告 | 原 vrt_receive_report（品項收發、庫存分析） |
| maintenance.html | 維修中心 | **新合併檔**：維修申請 + 臨時採購 + 兩套記錄查詢，單一檔案 |
| fuel.html | 燃油中心 | 原 Diesel v2 + 新增雲端上傳/下載 |
| expense.html | 費用中心 | 原費用管控 + 新增「資料維護」分頁（編輯/自訂類別/Excel/雲端） |
| AC_GA_EXP.gs | GAS 後端 | 單一專案，含 Bot、審批、雲端儲存、Dashboard API |

## 二、GAS 部署步驟

1. 開新 GAS 專案，命名 **AC_GA_EXP**，貼入 `AC_GA_EXP.gs` 全文。
2. 執行 `initPlatform()` 一次 → 自動建立 AC_GA_EXP_DB 試算表與全部工作表（PO_Records、Inventory、PO_Sequence、Temp_PO、Repair_Records、RECV_DB、DIESEL_DB、EXPENSE_DB、TG_Groups），Log 會印出 Sheet 網址。
3. 部署 → 新增部署 → 網頁應用程式 → 執行身分「我」、存取權「任何人」→ 複製 `/exec` 網址。
4. 執行 `setupPolling()` 建立每分鐘輪詢觸發器。**⚠️ 每次重新部署（含更新版本）後都要重跑 setupPolling()**，這就是之前 /prod 指令失效的同型問題。
5. 打開 index.html → ⚙️ 設定 → 貼上 `/exec` 網址 → 儲存 → 🔌 測試連線。

## 三、資料流

- 平台共用設定：`localStorage['ac_ga_exp_config']`（gasUrl、lang、tgGroups）。各模組讀不到自己的設定時，自動 fallback 到平台設定。
- 雲端儲存：RECV_DB / DIESEL_DB / EXPENSE_DB 採「分塊 JSON」存放（每格 45,000 字元），突破 Google Sheet 單格 50,000 上限。
- Dashboard（index.html）僅呼叫 `?action=dashboard` 唯讀彙總，不保存資料。
- Bot Token 只存在 GAS CONFIG，瀏覽器端不落地；維修照片改由 POST 經 GAS 轉發至群組。

## 四、Telegram 指令

`/order` 開啟採購中心 · `/po` `/purchase` 臨時採購表單 · `/repair` 維修表單 · `/status` 最新 PO · `/help` 說明。
群組管理：index.html → ✈️ 群組 → 可新增/修改/刪除、指定模組（all 或 po, repair, recv, diesel, expense）、儲存至雲端 TG_Groups。

## 五、本次修正清單

1. fuel.html：10 處 `toISOString()` 時區問題全部改本地日期；Telegram 移除 Markdown parse_mode（避免使用者資料含特殊字元導致發送失敗）。
2. receiving.html：2 處 `toISOString()` 修正；雲端 action 改 recvSave/recvLoad（GAS 保留 save/load 相容舊版）。
3. GAS：Temp/Repair 通知改 HTML parse_mode + `escapeHtml()`（使用者輸入含 `* _ [` 不再爆訊息）。
4. expense.html：原本資料寫死無法修改 → 新增資料維護分頁；Excel 匯入自動排除「合計」列防止資料膨脹；SheetJS 0.18.5 `cellDates:false, raw:true`。
5. maintenance.html：原 repair.html 內寫死的 Bot Token 已移除；照片上限 3 張、自動壓縮 800px。
6. 全模組 localStorage 僅存設定旗標；記錄資料走雲端。

## 六、第二階段（依規劃文件預留）

QR Code 掃描功能、Expense 自動彙總 PO/Repair/Diesel 來源、Fuel 車輛/司機主檔。資料結構已預留，穩定後再擴充。
