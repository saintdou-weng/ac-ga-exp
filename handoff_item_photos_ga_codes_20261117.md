# 交接：總務物品照片編碼（2026-11-17）

Paul 11/17：「發電機、公司車之類自行幫我編碼行了 — 總務歸總務、生產歸生產，別混一起。」
照片做法和生產相同（⭐ 標準照＋每月異常、可點開卡片一直往下滑），但**存在 GA-EXP 自己的雲端**，不放進 PROD 的 item_photos。

## 編碼（GA 開頭，不會和生產的 TCF／零件料號、人事的工號撞）
| 類別 | 編碼 | 卡片上同時顯示 |
|---|---|---|
| 發電機 Generator | GA-GEN-01, GA-GEN-02… | 廠牌／kVA／位置（A廠、B廠、宿舍） |
| 公司車 Company car / van / truck | GA-CAR-01, GA-CAR-02… | 車牌（原本加油、交通車資料用車牌，車牌當別名，兩個都搜得到） |
| 堆高機 Forklift | GA-FLT-01… | 廠牌／型號 |
| 機車 Motorbike | GA-MOT-01… | 車牌 |
| 總務用品 GA supplies | GA-SUP-0001… | 品名／規格（收貨物品主檔已有編號的就沿用，不另編） |

- 號碼依 fuel／transportation 紀錄裡第一次出現的順序編，編好就固定，不重編。
- 照片表（Excel：編號＋內嵌照片）匯入方式同 PROD v4.35/4.36。

## 狀態
- 還沒改程式：11/17 晚上另一個對話正在改 ac-ga-exp（page insight panel），等它停手再做，避免互相覆蓋。
- 生產（布料）已完成：vrt-prod v4.36，見 vrt-prod/work/HANDOFF_item_photos_fabric_20261117.md。
