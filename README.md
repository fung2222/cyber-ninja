# 異域凶間 XENO NIGHTMARE

> 賽博朋克 3D 直向射擊 · 10 章 × 5 關 · 50 種地圖變化 · 三種難度 · Three.js · 手機優先

**試玩 Play:** https://fung2222.github.io/cyber-ninja/ · **自動示範 Demo:** https://fung2222.github.io/cyber-ninja/?demo=1

![XENO NIGHTMARE — FALCON cyberpunk airframe](docs/shots/desktop-craft-falcon-v14.png)

## 故事 Story
Cyber world 正被數碼病毒 **「噬界 OUROBOROS」**入侵及蠶食，城市、記憶同現實規則逐一被改寫。三位駕駛員——**蒼隼 FALCON、壁壘 BASTION、幽影 WRAITH**——並肩作戰，穿越十個失守區域，奪回世界中樞並重啟黎明。

主線有 **10 章、每章 5 關，共 50 關**。每章有雙語劇情簡報、獨立名稱、主題配色及場景配置；每關嘅城市網格、道路、塔樓密度、遺跡方向、霧度及障礙節奏都有變化。每章第 5 關係 Boss 戰；完成第 50 關後進入無盡模式。

## 出擊流程 Loadout
主頁保持品牌＋出擊＋紀錄。**第一次玩**按 **出擊 LAUNCH** 會行以下三頁；**之後再撳出擊就一撳直接開打**，用返上次嘅機體、武器同章節。想改配置，撳出擊下面嘅 **配置 LOADOUT** 入返三頁（`lastLoadout` 記住 craft／weapon／chapter／difficulty）。三頁內容：

1. **選擇機體**：全闊 3D 旋轉展示完整機體，配上被動技能、四項屬性、機體介紹同故事簡報。三部程式生成 cyberpunk 戰機各有獨立結構：**蒼隼**採用後掠主翼、雙引擎及雙垂直尾翼；**壁壘**採用寬體多層裝甲、側掛炮管及四組推進器；**幽影**採用扁平隱形飛翼。金屬分區、座艙、進氣口、霓虹電路、全息環及漸隐能量尾焰會跟隨所選機體，底部水平三掣亦有各自的新縮圖。
2. **選擇武器**：頂部播放由正式遊戲渲染器錄製嘅**實機滿級戰鬥影片**。下方依序顯示性能、三級附加能力、大招及六級技能樹；已刪除長篇介紹與重複操作提示，手機一頁可睇晒，毋須滾動。
3. **章節／難度**：上方 1–10 章支援真正橫向觸控滑動。每章只有一個大型統一入口，顯示劇情、章節最高分及完成次數；進入後連續突破五關。完成整章才開下一章；每章依次完成故事 → 標準 → 凶間來解鎖更高難度。機體、武器、章節、各難度最高分與完成紀錄均以 JSON 保存在目前瀏覽器。

### 難度 Difficulty
- **故事 STORY**：額外 2 格護盾、敵彈速度 ×0.72、敵人射速 ×0.62、較多道具、受擊無敵 2.2 秒；適合新手同欣賞劇情。
- **標準 NORMAL**：降低開局壓力但保留完整走位挑戰；敵彈 ×0.86、敵人射速 ×0.82、受擊無敵 1.85 秒。
- **凶間 NIGHTMARE**：敵人 HP／彈速／射速提高，分數 ×1.5；適合熟練玩家。

## 玩法 How to play
- 喺畫面**任何位置拖動**移動戰機（相對拖動，手指唔會遮住角色）；戰機會**自動開火**，亦可飛到全版圖上方。
- **三種機體**：蒼隼速度 +14%；壁壘 4 格護盾兼 8 秒無傷回復 1 格；幽影傷害 +28%、充能 +40%、OVERDRIVE +1 秒，但只有 2 格基礎護盾。
- **三種武器、每種 6 級**：**脈衝**改為筆直彈道並提高傷害，LV.3 起每輪附加兩粒有真實爆炸傷害的追蹤爆彈；**鐳射**保留貫穿但降低單發傷害，LV.3 起有兩座浮遊炮陪伴機身，發射無貫穿鐳射；**震波**不再貫穿，命中後造成小範圍爆炸，LV.3 起每第 10 發變成大範圍震波。**W** 即時換槍並升該武器 1 級；**P** 提升目前武器一級。各武器保留獨立等級及儲能。
- **專屬大招**：彈幕洪流（180° 向前掃射）、稜鏡貫穿（多束直線光束＋連鎖雷擊）、奇點爆發（擴散衝擊波＋五重旋轉星環＋隕星粒子兼消彈）。大招期間無敵。
- **OVERDRIVE**：武器昇華 4 秒；**超載生效及完結散熱期間，只要能量已滿都可插入武器大招**。超載完結後強制普通開火停火散熱 3 秒。武器大招與 OVERDRIVE 的冷卻秒數都直接顯示在各自圓形技能球內，沒有外部冷卻條，裝飾層亦不會攔截觸控。
- 敵人使用編排隊形、瞄準彈及衝鋒；地圖有預警激光欄同漂移隕石。全黑敵機只加強發光輪廓線，唔會高亮整個機身；彩色敵人維持原設計。
- 每 5 關迎戰三階段星海魔獸。十章分別使用追蹤扇射、雙螺旋、交叉火網、鏡像夾擊、收縮圓環、預警雷射、花瓣綻放、反向彈輪、追蹤齊射及最終混合模式。粉紅彈殼配白色彈心，並控制高畫質光暈融合，保持彈道可讀。
- 擊破敵人跌出金色／白色晶石，自動飛向戰機，提供分數及充能。被擊中會失去 1 格護盾及 1 級目前武器；護盾歸零可復活一次。
- 無盡模式沿用五十種地圖指紋循環變化，敵人 HP、Boss HP 同射速設有上限；每 10 關有里程碑獎勵及護盾補滿。

## English
**XENO NIGHTMARE** is a one-thumb 3D cyberpunk vertical shooter. Ouroboros, a digital virus, is devouring the cyber world; three pilots fight through **10 chapters × 5 levels and 50 map variations**. First launch walks the three pages (craft → weapon → chapter/difficulty); afterwards LAUNCH starts the remembered loadout in one tap and the LOADOUT button reopens the pages (`lastLoadout` keeps craft/weapon/chapter/difficulty). FALCON, BASTION and WRAITH use separate procedural cyberpunk airframes. The mission page now has a touch-scrollable chapter rail and one large entry per chapter, launching all five stages consecutively. Clearing a chapter opens the next; Story → Normal → Nightmare unlock in sequence, with separate best scores and clears saved as JSON in the current browser. The weapon page fits its key stats, LV.3 special, ultimate and six-level tree on one phone screen. Pulse gains two damaging homing missiles at LV.3; lance keeps pierce at lower damage and gains two non-piercing support drones; nova detonates on impact without pierce and every tenth LV.3+ shot has a larger blast. Both skill cooldowns are numeric countdowns inside their circular buttons, with no external bars blocking touch.

## 操作 Controls
| 動作 | 手機 | 鍵盤 |
|---|---|---|
| 移動 Move | 拖動 Drag | ←→↑↓ / WASD |
| 武器大招 Weapon Ultimate | 左下藍色掣 | Space / Enter / X / J |
| 最大火力 OVERDRIVE | 左下橙色掣 | Q / O |
| 暫停 Pause | ⏸ | P / Esc |
| 靜音 Mute | 🔊 | M |

## 語言及網址 Language / URL flags
支援繁體中文（香港）及 English；可喺設定切換並記住選擇。網址參數：`?demo=1` · `?lang=en|zh` · `?fps=1` · `?quality=low` · `?glow=low|high` · `?adsim=1` · `?reset=1` · `?mute=1`。

## 技術 Tech
Three.js r169 + vendored cyber-kit v0.3.19，plain HTML/CSS/JS，無 build step。模型、場景、音效及音樂均為程式生成；武器預覽影片由本作正式渲染器實際錄製，保存為 WebM 並附 JPEG poster fallback。

## 開發 Development
```bash
python3 -m http.server 18940     # http://127.0.0.1:18940/index.html
node --test tests/
python3 tests/aircraft.py http://127.0.0.1:18940/index.html docs/shots
python3 tests/weapons.py http://127.0.0.1:18940/index.html
python3 tests/campaign.py http://127.0.0.1:18940/index.html
python3 tests/core.py http://127.0.0.1:18940/index.html
python3 tests/ult-reset.py http://127.0.0.1:18940/index.html
python3 tests/brand.py http://127.0.0.1:18940/index.html
python3 tests/smoke.py http://127.0.0.1:18940/index.html docs/shots
# Re-record real weapon previews after combat visuals change:
python3 tests/record-previews.py http://127.0.0.1:18940/index.html
```

文件：[docs/HANDOFF.md](docs/HANDOFF.md) · [docs/DEEP-AUDIT-2026-11-03.md](docs/DEEP-AUDIT-2026-11-03.md) · [privacy.html](privacy.html) · 屬於 [CYBER ARCADE](https://github.com/fung2222/cyber-arcade) 系列。
