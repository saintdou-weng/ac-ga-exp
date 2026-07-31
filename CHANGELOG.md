
## v2.0-alpha2 — 2026-07-31（expense.html 佈線完成）

### expense.html 完整重寫（第一個接上共用引擎的模組）
- **硬寫資料遷移**：原 HTML 內寫死的 201 筆 1–2 月交易，逐筆抽出為 canonical records
  存入 `shared/exp-seed.js`（`sourceModule:'seed'`）。**已核對每類別總額與原矩陣完全一致**
  （2026-01 = $10,181.88、2026-02 = $10,268.10），無任何資料遺失
- **逐筆交易資料庫**取代原月度矩陣：txns[] 為正式資料結構，線上新增與 Excel 匯入同源
- **六分頁**：總覽 KPI / 明細帳（排序搜尋分頁）/ 分類分析 / 期間趨勢 / 預算差異 / 新增費用
- **統一期間控制列**：日／週／月／年、前後、下拉、日期選擇，週一起算
- **完整三語**：i18n 字典 EN/KM 零缺漏；切 EN/KM 後 UI 無殘留中文
  （類別 label 如「⚡ Electricity 電費」屬業務資料，依規範保持雙語不翻譯）
- **圖表**：分類占比環圈、來源模組長條、分類金額橫條、期間趨勢折線（切期間 destroy 重建）
- **雲端上/下載**：頁首圖示，六態指示；`expenseSave/Load` 走既有 chunked KV，相容
- **智慧匯入**：接 `GA.smartImport`，Excel 費用自動辨識、去重、預覽
- **Telegram 摘要**：`canApprove:false`（費用無核可流程），只發摘要、可選日/週/月/年與中英雙語
- **手動新增費用**：預估／實際金額分開，線上逐筆建立
- **來源可追溯**：每筆保留 sourceModule / recordId，為後續「PO/Repair/Fuel 自動彙總」預留

### 驗證（jsdom 實測通過）
- GA 引擎載入、期間工具（週一起算、Excel serial 不跨日、ratio 分母 0 顯示「資料不足」）
- 三語切換、i18n audit（EN/KM 缺漏 0）
- seed 遷移總額核對一致、KPI 計算、DOM 渲染
