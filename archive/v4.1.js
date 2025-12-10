// ==UserScript==
// @name         广东省教师继续教育刷课助手-V4.1(多域名适配版)
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  修正域名匹配、增加运行状态面板、自动答题、自动跳转
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
        thinkTimeMin: 1500,
        thinkTimeMax: 3500,
        reloadThreshold: 60,
    };

    // ==========================================
    // MODULE 0: 可视化状态面板 (新增)
    // 让你一眼就知道脚本有没有在跑
    // ==========================================
    const infoBox = document.createElement('div');
    infoBox.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.8);
        color: #00ff00;
        padding: 10px;
        border-radius: 5px;
        font-size: 14px;
        font-family: monospace;
        pointer-events: none;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
    `;
    infoBox.innerHTML = "🤖 刷课助手 V4.1 已启动<br>⏳ 等待初始化...";
    document.body.appendChild(infoBox);

    function updateStatus(text, color = "#00ff00") {
        infoBox.style.color = color;
        infoBox.innerHTML = `🤖 刷课助手运行中<br>${text}`;
    }

    // ==========================================
    // MODULE 1: 视觉欺骗 (后台防冻结)
    // ==========================================
    try {
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
        Object.defineProperty(document, 'hidden', { get: () => false });
        window.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
        window.addEventListener('blur', e => e.stopImmediatePropagation(), true);
    } catch (e) {}

    // ==========================================
    // MODULE 2: 主逻辑循环
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
            console.error("循环异常:", e);
            updateStatus("❌ 发生错误 (看控制台)", "red");
        }

        const delay = Math.floor(Math.random() * (CONFIG.maxInterval - CONFIG.minInterval + 1) + CONFIG.minInterval);
        setTimeout(gameLoop, delay);
    }
    
    // 启动引擎
    setTimeout(gameLoop, 2000);

    // ==========================================
    // 功能函数实现
    // ==========================================

    // --- 1. 视频与网络维护 ---
    function handleVideo() {
        const video = document.querySelector('video');
        if (!video) {
            updateStatus("⏳ 未检测到视频元素...", "yellow");
            return;
        }

        // 状态显示
        if (video.paused) updateStatus("⏸️ 尝试自动播放...", "orange");
        else updateStatus(`▶️ 正在播放 (进度: ${Math.floor(video.currentTime)}s)`);

        // A. 强制倍速 1.0
        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;

        // B. 自动静音与播放
        if (!video.muted) video.muted = true; // 静音是自动播放的前提
        
        if (video.paused) {
            // 优先点击页面上的大按钮
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb, .playchzqozkmgsbb');
            if(playBtn && playBtn.offsetParent !== null) { // 按钮可见
                playBtn.click();
                console.log("点击了页面播放按钮");
            } else {
                // 尝试代码启动
                let promise = video.play();
                if (promise !== undefined) {
                    promise.catch(error => {
                        updateStatus("⚠️ 浏览器阻止自动播放<br>请手动点击一下视频区域", "red");
                        // 很多浏览器必须用户交互一次才能播放，这是强制规则
                    });
                }
            }
        }

        // C. 卡死检测
        if (!video.paused && Math.abs(video.currentTime - lastVideoTime) < 0.1) {
            stuckCounter++;
            updateStatus(`⚠️ 视频卡顿检测: ${stuckCounter}`, "orange");
            if (stuckCounter * (CONFIG.minInterval/1000) > CONFIG.reloadThreshold) {
                location.reload();
            }
        } else {
            lastVideoTime = video.currentTime;
            stuckCounter = 0;
        }
    }

    // --- 2. 防挂机弹窗 ---
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

        // 屏蔽 Alert
        if (iframe.contentWindow && !iframe.contentWindow.hasHookedAlert) {
            iframe.contentWindow.alert = function() {}; 
            iframe.contentWindow.hasHookedAlert = true;
        }

        const inputs = doc.querySelectorAll('input[name="response"]');
        const submitBtn = doc.querySelector('.u-main-btn, .btn-submit');

        if (inputs.length > 0 && submitBtn && !iframe.contentWindow.isAnswering) {
            updateStatus("📝 正在自动答题...", "#00ffff");
            iframe.contentWindow.isAnswering = true;
            
            const thinkTime = Math.floor(Math.random() * (CONFIG.thinkTimeMax - CONFIG.thinkTimeMin) + CONFIG.thinkTimeMin);

            setTimeout(() => {
                let checkedIndex = -1;
                inputs.forEach((inp, i) => { if(inp.checked) checkedIndex = i; });
                
                let nextIndex = (checkedIndex + 1) % inputs.length;
                
                const target = inputs[nextIndex];
                let clickArea = target;
                if(target.parentElement && target.parentElement.tagName === 'STRONG') {
                    clickArea = target.parentElement.parentElement;
                }
                clickArea.click();
                target.click();

                setTimeout(() => {
                    submitBtn.click();
                    iframe.contentWindow.isAnswering = false;
                }, 600);
            }, thinkTime);
        }
    }

    // --- 4. 智能跳转 ---
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
            updateStatus("✅ 本节完成，准备跳转...", "#00ff00");

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