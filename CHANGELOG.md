
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
