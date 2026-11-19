Life RPG — 跨端 PWA + 云端同步版说明
====================================
本版本支持：
1. 直接双击 index.html 在电脑本地使用（无需服务器）
2. 托管到 GitHub Pages / Vercel 后，手机“添加到主屏幕”即可变成全屏 App (PWA)
3. 接入免费 Supabase 云端数据库后，电脑 ↔ 手机、电脑 ↔ 电脑自动实时同步

目录结构：
- index.html          页面骨架、PWA 配置与弹窗结构
- manifest.json       手机桌面 App 图标与全屏启动配置
- sw.js               PWA 离线缓存脚本（联网优先更新最新代码）
- assets/             App 桌面图标 (icon-192.png, icon-512.png)
- css/themes.css      全部 13 套主题配色
- css/styles.css      布局与移动端适配样式
- js/config.js        默认配置与日常任务库
- js/helpers.js       通用工具、Toast 与烟花动画
- js/state.js         本地存档读写与跨天自动刷新
- js/sync.js          Supabase 云端自动同步模块
- js/timer.js         绝对时间计时器与 Study Records
- js/actions.js       Quests、To-Do（固定/盲盒）、支出与盲盒
- js/views.js         Dashboard、Daily Records 与 7 天 Timeline
- js/main.js          Settings 弹窗、主题字号与启动入口

Supabase 建表 SQL（只需在 Supabase SQL Editor 运行一次）：
create table if not exists public.life_rpg_saves (
  id text primary key,
  data jsonb not null,
  updated_at bigint not null
);
alter table public.life_rpg_saves disable row level security;
