// ==UserScript==
// @name         广东省教师继续教育刷课助手-V3.2(后台防冻结版)
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  伪造前台活跃状态(支持最小化挂机)、自动答题、自动静音、安全防检测
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
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
        reloadThreshold: 180, // 3分钟不动刷新
    };

    console.log("🚀 刷课脚本 V3.2 (后台增强版) 已启动");

    // ==========================================
    // MODULE: 视觉欺骗 (核心黑科技)
    // 强制欺骗浏览器和网页，让其认为当前页面永远处于“可见”和“激活”状态
    // ==========================================
    try {
        // 1. 锁定 visibilityState 属性
        Object.defineProperty(document, 'visibilityState', {
            get: function() { return 'visible'; }
        });
        Object.defineProperty(document, 'hidden', {
            get: function() { return false; }
        });

        // 2. 拦截并阻止“失去焦点”事件
        // 即使你切换窗口，网页也收不到 blur 消息
        const blockEvents = ['visibilitychange', 'webkitvisibilitychange', 'blur', 'pagehide', 'mouseleave'];
        blockEvents.forEach(evt => {
            window.addEventListener(evt, function(e) {
                e.stopImmediatePropagation();
                e.stopPropagation();
            }, true);
        });
        
        // 3. 欺骗焦点状态
        // 某些网站检查 document.hasFocus()
        document.hasFocus = function() { return true; };
        
        console.log("✅ 视觉欺骗模块加载成功：网页将始终认为自己在前台");
    } catch (e) {
        console.warn("视觉欺骗模块加载部分失败（不影响基础功能）", e);
    }

    // ==========================================
    // MODULE: 业务逻辑
    // ==========================================

    let lastVideoTime = -1;
    let stuckCounter = 0;

    // 启动主循环
    setTimeout(gameLoop, 2000);

    function gameLoop() {
        try {
            safeHandleVideo();
            handleAntiIdle();
            handleQuiz();
            handleNext();
        } catch (e) {
            console.error("循环异常:", e);
        }

        // 随机延迟递归
        const randomDelay = Math.floor(Math.random() * (CONFIG.maxInterval - CONFIG.minInterval + 1) + CONFIG.minInterval);
        setTimeout(gameLoop, randomDelay);
    }

    // --- 1. 视频处理 ---
    function safeHandleVideo() {
        const video = document.querySelector('video');
        if (!video) return;

        // 锁定倍速 1.0
        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;

        // 保持静音
        if (!video.muted) video.muted = true;

        // 保持播放
        if (video.paused) {
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
            if(playBtn) playBtn.click();
            else video.play().catch(()=>{});
        }

        // 卡顿/结束检测
        if (Math.abs(video.currentTime - lastVideoTime) < 0.1) {
            stuckCounter++;
            if (stuckCounter * (CONFIG.minInterval/1000) > CONFIG.reloadThreshold) {
                location.reload();
            }
        } else {
            lastVideoTime = video.currentTime;
            stuckCounter = 0;
        }
    }

    // --- 2. 防挂机 ---
    function handleAntiIdle() {
        const btn = document.querySelector('.mylayer-btn3');
        if (btn) btn.click();
    }

    // --- 3. 自动答题 ---
    function handleQuiz() {
        const iframe = document.querySelector('iframe[id^="layui-layer-iframe"]');
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return;

        // 屏蔽弹窗警告
        if (iframe.contentWindow && !iframe.contentWindow.hasHookedAlert) {
            iframe.contentWindow.alert = function() {}; 
            iframe.contentWindow.hasHookedAlert = true;
        }

        const inputs = doc.querySelectorAll('input[name="response"]');
        const submitBtn = doc.querySelector('.u-main-btn, .btn-submit');

        if (inputs.length > 0 && submitBtn && !iframe.contentWindow.isAnswering) {
            iframe.contentWindow.isAnswering = true;
            
            // 随机思考时间
            const thinkTime = Math.floor(Math.random() * (CONFIG.thinkTimeMax - CONFIG.thinkTimeMin + 1) + CONFIG.thinkTimeMin);
            console.log(`答题中... 思考 ${thinkTime}ms`);

            setTimeout(() => {
                let checkedIndex = -1;
                for (let i = 0; i < inputs.length; i++) {
                    if (inputs[i].checked) { checkedIndex = i; break; }
                }
                
                // 盲猜下一个
                let nextIndex = (checkedIndex + 1) % inputs.length;
                
                // 触发点击
                const inputToClick = inputs[nextIndex];
                let clickable = inputToClick;
                // 尝试点击 Label
                if(inputToClick.parentElement && inputToClick.parentElement.tagName === 'STRONG') {
                    clickable = inputToClick.parentElement.parentElement;
                }
                clickable.click();
                inputToClick.click();

                // 提交
                setTimeout(() => {
                    submitBtn.click();
                    iframe.contentWindow.isAnswering = false;
                }, 500);
            }, thinkTime);
        }
    }

    // --- 4. 跳转逻辑 ---
    function handleNext() {
        const currentSpan = document.getElementById('viewTimeTxt');
        if (!currentSpan) return;
        
        // 提取时间逻辑
        const parentP = currentSpan.parentElement;
        if (!parentP) return;
        const allSpans = parentP.querySelectorAll('span');
        if(allSpans.length < 2) return;

        const totalTime = parseInt(allSpans[0].innerText);
        const curTime = parseInt(currentSpan.innerText);
        const nextBtn = document.querySelector('.btn.next');

        if (!isNaN(totalTime) && !isNaN(curTime) && curTime >= totalTime) {
            if (nextBtn) nextBtn.click();
            else try { if(window.goNext) window.goNext(); } catch(e){}
        }
        
        // 视频本身播放结束也跳转
        const video = document.querySelector('video');
        if(video && video.ended && nextBtn) nextBtn.click();
    }

})();