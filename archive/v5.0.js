// ==UserScript==
// @name         广东省教师继续教育刷课助手-V5.0(防掉线保命版)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  强制防掉线(卡住自动刷新)、优先答题、可视面板、双域名适配
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @match        https://jsxx.gdedu.gov.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === 核心配置 ===
    const CONFIG = {
        minInterval: 3000,
        maxInterval: 5000,
        thinkTimeMin: 1500,
        thinkTimeMax: 3000,
        // 关键配置：如果视频暂停不动超过这个时间(秒)，直接刷新页面
        // 设为 60秒，远小于15分钟，绝对安全
        pausedTimeout: 60, 
    };

    // ==========================================
    // MODULE: 状态面板 (增强版)
    // ==========================================
    const infoBox = document.createElement('div');
    infoBox.id = 'tm-status-panel';
    infoBox.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.9);
        color: #00ff00;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        font-family: sans-serif;
        box-shadow: 0 4px 15px rgba(0,0,0,0.8);
        border: 1px solid #444;
        line-height: 1.6;
        min-width: 200px;
    `;
    infoBox.innerHTML = "🛡️ 防掉线系统初始化...";
    document.body.appendChild(infoBox);

    function updateStatus(mainMsg, subMsg = "", color = "#00ff00") {
        infoBox.style.color = color;
        infoBox.innerHTML = `
            <strong>🛡️ 刷课助手 V5.0</strong><br>
            ${mainMsg}<br>
            <span style="font-size:12px; color:#aaa;">${subMsg}</span>
        `;
    }

    // ==========================================
    // MODULE: 后台防冻结
    // ==========================================
    try {
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
        Object.defineProperty(document, 'hidden', { get: () => false });
        window.addEventListener('blur', e => e.stopImmediatePropagation(), true);
        window.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
    } catch (e) {}

    // ==========================================
    // 全局变量
    // ==========================================
    let pausedCounter = 0; // 记录视频暂停了多久
    let lastVideoTime = -1;

    // ==========================================
    // 主循环
    // ==========================================
    function gameLoop() {
        try {
            // 1. 优先检测答题 (如果有弹窗，先不管视频)
            const hasQuiz = handleQuiz();

            if (!hasQuiz) {
                // 2. 如果没弹窗，维护视频状态
                handleVideo();
            }

            // 3. 进度跳转
            handleNextCourse();

        } catch (e) {
            console.error(e);
            updateStatus("❌ 脚本运行出错", "请查看控制台", "red");
        }

        const delay = Math.floor(Math.random() * (CONFIG.maxInterval - CONFIG.minInterval) + CONFIG.minInterval);
        setTimeout(gameLoop, delay);
    }
    
    setTimeout(gameLoop, 3000);

    // ==========================================
    // 功能函数
    // ==========================================

    // --- 1. 自动答题 (返回 true 表示正在答题) ---
    function handleQuiz() {
        const iframe = document.querySelector('iframe[id^="layui-layer-iframe"]');
        if (!iframe) return false; // 没弹窗
        
        // 尝试获取 iframe 内容
        let doc;
        try {
            doc = iframe.contentDocument || iframe.contentWindow.document;
        } catch(e) {
            // 如果跨域报错，说明无法触摸弹窗 -> 触发超时刷新机制
            updateStatus("🔒 无法自动答题(跨域)", "等待超时刷新以跳过...", "orange");
            return true; // 仍然算作有弹窗，阻止视频播放逻辑
        }

        if (!doc) return false;

        // 屏蔽弹窗警告
        if (iframe.contentWindow && !iframe.contentWindow.hasHookedAlert) {
            iframe.contentWindow.alert = function() {}; 
            iframe.contentWindow.hasHookedAlert = true;
        }

        const inputs = doc.querySelectorAll('input[name="response"]');
        const submitBtn = doc.querySelector('.u-main-btn, .btn-submit');

        if (inputs.length > 0 && submitBtn) {
            // 如果还没开始答，标记一下
            if (!iframe.contentWindow.isAnswering) {
                iframe.contentWindow.isAnswering = true;
                updateStatus("📝 检测到题目", "正在盲猜答案...", "#00ffff");
                
                setTimeout(() => {
                    let checkedIndex = -1;
                    inputs.forEach((inp, i) => { if(inp.checked) checkedIndex = i; });
                    let nextIndex = (checkedIndex + 1) % inputs.length;
                    
                    // 点击
                    const target = inputs[nextIndex];
                    let clickArea = target;
                    if(target.parentElement && target.parentElement.tagName === 'STRONG') {
                        clickArea = target.parentElement.parentElement;
                    }
                    clickArea.click();
                    target.click();

                    // 提交
                    setTimeout(() => {
                        submitBtn.click();
                        // 提交后重置，如果没对，下一次循环会继续选下一个
                        iframe.contentWindow.isAnswering = false;
                    }, 600);
                }, 2000);
            }
            return true; // 正在处理弹窗
        }
        return false;
    }

    // --- 2. 视频控制与防掉线自救 ---
    function handleVideo() {
        const video = document.querySelector('video');
        if (!video) {
            updateStatus("⏳ 寻找视频中...", "页面可能未加载完", "yellow");
            return;
        }

        // 强制倍速 1.0
        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;
        if (!video.muted) video.muted = true;

        // === 核心逻辑：防掉线倒计时 ===
        if (video.paused) {
            pausedCounter++; // 每次循环+1 (约3-5秒)
            const secondsWait = pausedCounter * 4; // 估算秒数

            updateStatus("⚠️ 视频已暂停", `防卡死倒计时: ${CONFIG.pausedTimeout - secondsWait}秒`, "orange");

            // 尝试恢复播放
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
            if(playBtn && playBtn.offsetParent) playBtn.click();
            else video.play().catch(()=>{});

            // 🚨 超时自救：如果暂停超过设定阈值 (如60秒)
            if (secondsWait > CONFIG.pausedTimeout) {
                updateStatus("🚨 检测到长时间卡死", "正在执行：强制刷新页面...", "red");
                console.log("防掉线触发：刷新页面");
                location.reload(); // <--- 这里是保命的关键
            }
        } else {
            // 视频在播放，重置计数器
            pausedCounter = 0;
            updateStatus("▶️ 正常播放中", `当前进度: ${Math.floor(video.currentTime)}s`);
        }
    }

    // --- 3. 自动跳转 ---
    function handleNextCourse() {
        const currentSpan = document.getElementById('viewTimeTxt');
        if (!currentSpan) return;
        
        const parentP = currentSpan.parentElement;
        if (!parentP) return;
        const allSpans = parentP.querySelectorAll('span');
        if(allSpans.length < 2) return;

        const totalTime = parseInt(allSpans[0].innerText);
        const curTime = parseInt(currentSpan.innerText);
        const video = document.querySelector('video');

        const isTimeDone = (!isNaN(totalTime) && !isNaN(curTime) && curTime >= totalTime);
        const isVideoDone = (video && video.ended);

        if (isTimeDone || isVideoDone) {
            updateStatus("✅ 课程结束", "正在跳转下一节...", "#00ff00");

            const nextBtn = document.querySelector('.btn.next');
            if (nextBtn && !nextBtn.classList.contains('disabled')) {
                nextBtn.click();
                return;
            }

            const sidebar = document.querySelector('.g-study-sd');
            if (sidebar) {
                const allLinks = Array.from(sidebar.querySelectorAll('a.section'));
                const currentIndex = allLinks.findIndex(link => link.classList.contains('z-crt'));
                if (currentIndex !== -1 && currentIndex < allLinks.length - 1) {
                    allLinks[currentIndex + 1].click();
                }
            }
        }
    }

})();