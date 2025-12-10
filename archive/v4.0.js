// ==UserScript==
// @name         广东省教师继续教育刷课助手-V4.0(终极融合版)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  双重导航(侧边栏+按钮)、智能纠错、断网重连、自动答题、后台挂机
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === 核心配置 ===
    const CONFIG = {
        minInterval: 3000,      // 最小检测间隔 (ms)
        maxInterval: 6000,      // 最大检测间隔 (ms)
        thinkTimeMin: 1500,     // 答题最小思考时间
        thinkTimeMax: 3500,     // 答题最大思考时间
        reloadThreshold: 60,    // 视频卡死判定阈值 (秒) - 针对网络错误优化
    };

    console.log("🚀 刷课脚本 V4.0 终极版已启动 - 全功能护航中");

    // ==========================================
    // MODULE 1: 视觉欺骗 (后台防冻结)
    // ==========================================
    try {
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
        Object.defineProperty(document, 'hidden', { get: () => false });
        window.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
        window.addEventListener('blur', e => e.stopImmediatePropagation(), true);
        console.log("✅ 后台防冻结模块已激活");
    } catch (e) { console.warn("后台模块部分加载失败", e); }

    // ==========================================
    // MODULE 2: 主逻辑循环
    // ==========================================
    let lastVideoTime = -1;
    let stuckCounter = 0;

    function gameLoop() {
        try {
            // 1. 视频管理 (含断网重连)
            handleVideo();
            // 2. 弹窗处理 (防挂机)
            handleAntiIdle();
            // 3. 自动答题 (Iframe穿透)
            handleQuiz();
            // 4. 自动跳转 (双重保险)
            handleNextCourse();
        } catch (e) {
            console.error("循环异常:", e);
        }

        // 随机延迟递归
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
        if (!video) return;

        // A. 强制倍速 1.0 (安全核心)
        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;

        // B. 自动静音与播放
        if (!video.muted) video.muted = true;
        if (video.paused) {
            // 优先点击页面按钮，模拟真人
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
            if(playBtn) playBtn.click();
            else video.play().catch(()=>{});
        }

        // C. 卡死/网络错误检测
        // 如果当前时间与上次记录的时间差小于 0.1秒，认为卡住了
        if (Math.abs(video.currentTime - lastVideoTime) < 0.1) {
            stuckCounter++;
            // 如果连续卡顿超过阈值 (60秒 / 3秒一次 = 20次)
            if (stuckCounter * (CONFIG.minInterval/1000) > CONFIG.reloadThreshold) {
                console.log(`⚠️ 检测到视频卡死或网络中断超过 ${CONFIG.reloadThreshold} 秒，尝试刷新页面修复...`);
                location.reload();
            }
        } else {
            // 视频在动，重置计数器
            lastVideoTime = video.currentTime;
            stuckCounter = 0;
        }
    }

    // --- 2. 防挂机弹窗 ---
    function handleAntiIdle() {
        // "继续学习" 按钮
        const btn = document.querySelector('.mylayer-btn3');
        if (btn) {
            console.log("🖱️ 移除防挂机遮罩");
            btn.click();
        }
    }

    // --- 3. 自动答题 (Iframe) ---
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
            iframe.contentWindow.isAnswering = true;
            const thinkTime = Math.floor(Math.random() * (CONFIG.thinkTimeMax - CONFIG.thinkTimeMin) + CONFIG.thinkTimeMin);
            console.log(`📝 发现题目，思考 ${thinkTime}ms ...`);

            setTimeout(() => {
                let checkedIndex = -1;
                inputs.forEach((inp, i) => { if(inp.checked) checkedIndex = i; });
                
                // 试错逻辑：选下一个
                let nextIndex = (checkedIndex + 1) % inputs.length;
                
                // 模拟点击
                const target = inputs[nextIndex];
                let clickArea = target;
                if(target.parentElement && target.parentElement.tagName === 'STRONG') {
                    clickArea = target.parentElement.parentElement; // 对应 label
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

    // --- 4. 智能跳转 (双重保险) ---
    function handleNextCourse() {
        const currentSpan = document.getElementById('viewTimeTxt');
        if (!currentSpan) return;
        
        // 判定是否完成
        // 结构: <p>要求...<span>47</span>...已观看<span id="viewTimeTxt">13</span>...</p>
        const parentP = currentSpan.parentElement;
        if (!parentP) return;
        const allSpans = parentP.querySelectorAll('span');
        if(allSpans.length < 2) return;

        const totalTime = parseInt(allSpans[0].innerText);
        const curTime = parseInt(currentSpan.innerText);
        const video = document.querySelector('video');
        
        // 满足条件：时间达标 或 视频播放结束
        const isTimeDone = (!isNaN(totalTime) && !isNaN(curTime) && curTime >= totalTime);
        const isVideoDone = (video && video.ended);

        if (isTimeDone || isVideoDone) {
            console.log("✅ 当前课程已完成，正在寻找下一课...");

            // 策略 A：点击页面底部的“下一个活动”按钮
            const nextBtn = document.querySelector('.btn.next');
            if (nextBtn && !nextBtn.classList.contains('disabled')) {
                console.log("👉 策略A：点击底部按钮跳转");
                nextBtn.click();
                return;
            }

            // 策略 B：侧边栏目录跳转 (根据你提供的HTML深度定制)
            // 1. 找到侧边栏容器
            const sidebar = document.querySelector('.g-study-sd');
            if (sidebar) {
                // 2. 获取所有课程链接 (class="section")
                // 注意：这里使用 Array.from 方便操作
                const allLinks = Array.from(sidebar.querySelectorAll('a.section'));
                
                // 3. 找到当前高亮的链接 (class 包含 "z-crt")
                const currentIndex = allLinks.findIndex(link => link.classList.contains('z-crt'));
                
                if (currentIndex !== -1 && currentIndex < allLinks.length - 1) {
                    console.log(`👉 策略B：侧边栏跳转 (${currentIndex} -> ${currentIndex + 1})`);
                    const nextLink = allLinks[currentIndex + 1];
                    
                    // 即使它是 hidden 的，JS click() 通常也能触发，但为了保险，
                    // 我们可以先尝试点击它的父级 dt (如果是跨章节的话)，不过这里直接点链接通常最有效
                    nextLink.click();
                } else {
                    console.log("🏁 似乎已经是最后一课了，脚本暂停跳转。");
                }
            }
        }
    }

})();