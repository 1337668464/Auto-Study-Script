// ==UserScript==
// @name         广东省教师继续教育刷课助手-V4.2(精准适配版)
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  适配jsxx/jsglpt域名、可视运行状态、自动答题、自动跳转、防断网
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
        maxInterval: 6000,
        thinkTimeMin: 1500,     // 答题思考时间最小值
        thinkTimeMax: 3500,     // 答题思考时间最大值
        reloadThreshold: 60,    // 60秒卡死刷新
    };

    // ==========================================
    // MODULE: 状态显示面板 (让你心里有底)
    // ==========================================
    const infoBox = document.createElement('div');
    infoBox.id = 'tm-status-panel';
    infoBox.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.85);
        color: #00ff00;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        font-family: "Microsoft YaHei", sans-serif;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        border: 1px solid #333;
        line-height: 1.5;
    `;
    infoBox.innerHTML = "🤖 刷课助手 V4.2 已就绪<br>⏳ 正在初始化...";
    document.body.appendChild(infoBox);

    function updateStatus(text, color = "#00ff00") {
        const time = new Date().toLocaleTimeString();
        infoBox.style.color = color;
        infoBox.innerHTML = `🤖 刷课助手运行中 (${time})<br>${text}`;
    }

    // ==========================================
    // MODULE: 后台防冻结 (支持最小化)
    // ==========================================
    try {
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
        Object.defineProperty(document, 'hidden', { get: () => false });
        // 拦截页面失去焦点的事件
        window.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
        window.addEventListener('blur', e => e.stopImmediatePropagation(), true);
        window.addEventListener('pagehide', e => e.stopImmediatePropagation(), true);
    } catch (e) {}

    // ==========================================
    // 主循环逻辑
    // ==========================================
    let lastVideoTime = -1;
    let stuckCounter = 0;

    function gameLoop() {
        try {
            handleVideo();
            handleAntiIdle();
            handleQuiz();
            handleNextCourse();
        } catch (e) {
            console.error("运行错误:", e);
            updateStatus("❌ 发生错误，请查看控制台", "red");
        }

        const delay = Math.floor(Math.random() * (CONFIG.maxInterval - CONFIG.minInterval + 1) + CONFIG.minInterval);
        setTimeout(gameLoop, delay);
    }
    
    // 延迟启动，等待页面加载
    setTimeout(gameLoop, 2500);

    // ==========================================
    // 功能函数
    // ==========================================

    // --- 1. 视频控制 ---
    function handleVideo() {
        const video = document.querySelector('video');
        if (!video) {
            updateStatus("⏳ 未找到视频，等待加载...", "yellow");
            return;
        }

        // 状态反馈
        if (video.paused) {
            updateStatus("⏸️ 视频暂停中，尝试启动...", "orange");
        } else {
            updateStatus(`▶️ 正在播放 | 进度: ${Math.floor(video.currentTime)}s`, "#00ff00");
        }

        // 强制倍速正常
        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;

        // 静音 (必须静音才能自动播放)
        if (!video.muted) video.muted = true;
        
        // 尝试播放
        if (video.paused) {
            // 优先点网页按钮
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb, .playchzqozkmgsbb');
            if(playBtn && playBtn.offsetParent) { 
                playBtn.click();
            } else {
                // 代码强制播放
                video.play().catch(e => {
                    updateStatus("⚠️ 浏览器限制自动播放<br>👉 请在页面任意位置点一下鼠标！", "#ff00ff");
                });
            }
        }

        // 卡顿检测
        if (!video.paused && Math.abs(video.currentTime - lastVideoTime) < 0.1) {
            stuckCounter++;
            updateStatus(`⚠️ 检测到卡顿/缓冲 (${stuckCounter})`, "orange");
            if (stuckCounter * (CONFIG.minInterval/1000) > CONFIG.reloadThreshold) {
                location.reload(); // 刷新网页
            }
        } else {
            lastVideoTime = video.currentTime;
            stuckCounter = 0;
        }
    }

    // --- 2. 防挂机 ---
    function handleAntiIdle() {
        const btn = document.querySelector('.mylayer-btn3');
        if (btn) {
            updateStatus("⚡ 自动点击'继续学习'", "#00ffff");
            btn.click();
        }
    }

    // --- 3. 自动答题 ---
    function handleQuiz() {
        const iframe = document.querySelector('iframe[id^="layui-layer-iframe"]');
        if (!iframe) return;
        
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return;

        // 屏蔽弹窗报错
        if (iframe.contentWindow && !iframe.contentWindow.hasHookedAlert) {
            iframe.contentWindow.alert = function() {}; 
            iframe.contentWindow.hasHookedAlert = true;
        }

        const inputs = doc.querySelectorAll('input[name="response"]');
        const submitBtn = doc.querySelector('.u-main-btn, .btn-submit');

        if (inputs.length > 0 && submitBtn && !iframe.contentWindow.isAnswering) {
            updateStatus("📝 发现题目，正在自动作答...", "#00ffff");
            iframe.contentWindow.isAnswering = true;
            
            const thinkTime = Math.floor(Math.random() * (CONFIG.thinkTimeMax - CONFIG.thinkTimeMin) + CONFIG.thinkTimeMin);

            setTimeout(() => {
                // 查找当前选中项，如果没有就默认-1
                let checkedIndex = -1;
                inputs.forEach((inp, i) => { if(inp.checked) checkedIndex = i; });
                
                // 简单的轮询策略：选下一个
                let nextIndex = (checkedIndex + 1) % inputs.length;
                
                const target = inputs[nextIndex];
                // 尝试点击 label 父元素以触发样式更新
                let clickArea = target;
                if(target.parentElement && target.parentElement.tagName === 'STRONG') {
                    clickArea = target.parentElement.parentElement;
                }
                clickArea.click();
                target.click();

                setTimeout(() => {
                    submitBtn.click();
                    iframe.contentWindow.isAnswering = false; // 解锁
                }, 600);
            }, thinkTime);
        }
    }

    // --- 4. 自动跳转 ---
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
            updateStatus("✅ 本节已学完，跳转下一课...", "#00ff00");

            // 策略1：底部按钮
            const nextBtn = document.querySelector('.btn.next');
            if (nextBtn && !nextBtn.classList.contains('disabled')) {
                nextBtn.click();
                return;
            }

            // 策略2：侧边栏目录
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