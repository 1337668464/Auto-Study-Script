// ==UserScript==
// @name         广东省教师继续教育刷课助手-V3.1(安全仿真版)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  安全挂机：随机检测频率、模拟人工思考时间、防检测、自动答题(试错机制)、自动下一课
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === 安全配置区域 ===
    const SAFETY_CONFIG = {
        minInterval: 3000,      // 最小检查间隔 (3秒)
        maxInterval: 6000,      // 最大检查间隔 (6秒) - 随机波动，防检测
        thinkTimeMin: 1500,     // 答题最小思考时间 (1.5秒)
        thinkTimeMax: 3500,     // 答题最大思考时间 (3.5秒)
        reloadThreshold: 150,   // 卡顿容忍时间 (秒)
    };

    let lastVideoTime = -1;
    let stuckCounter = 0;

    console.log("🔒 刷课脚本 V3.1 安全仿真版已启动");
    console.log("提示：为了安全，脚本运行速度会模拟真人，请保持浏览器窗口不要最小化。");

    // === 核心驱动 (随机时间循环) ===
    function gameLoop() {
        try {
            // 1. 视频维护
            safeHandleVideo();
            // 2. 防挂机弹窗
            handleAntiIdle();
            // 3. 自动答题
            handleQuiz();
            // 4. 进度跳转
            handleNext();
        } catch (e) {
            console.error("运行异常:", e);
        }

        // 计算下一次运行时间：随机 3~6秒
        const randomDelay = Math.floor(Math.random() * (SAFETY_CONFIG.maxInterval - SAFETY_CONFIG.minInterval + 1) + SAFETY_CONFIG.minInterval);
        setTimeout(gameLoop, randomDelay);
    }

    // 启动循环
    setTimeout(gameLoop, 2000);


    // ================= 功能实现 =================

    // --- 1. 安全视频处理 ---
    function safeHandleVideo() {
        const video = document.querySelector('video');
        if (!video) return;

        // 强制 1.0 倍速 (核心安全策略)
        if (video.playbackRate !== 1.0) {
            video.playbackRate = 1.0;
            console.log("⚠️ 检测到倍速异常，已强制恢复 1.0 倍速以防封号");
        }

        // 静音并播放
        if (!video.muted) video.muted = true;
        if (video.paused) {
            // 模拟点击播放（优先点按钮，更像人）
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
            if(playBtn) {
                playBtn.click();
            } else {
                video.play().catch(()=>{});
            }
        }

        // 卡顿检测
        if (Math.abs(video.currentTime - lastVideoTime) < 0.1) {
            stuckCounter++;
            if (stuckCounter * (SAFETY_CONFIG.minInterval/1000) > SAFETY_CONFIG.reloadThreshold) {
                console.log("视频卡死超过2分钟，执行页面刷新...");
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
        if (btn) {
            console.log("🖱️ 点击‘继续学习’...");
            btn.click();
        }
    }

    // --- 3. 仿真答题 (带随机思考时间) ---
    function handleQuiz() {
        const iframe = document.querySelector('iframe[id^="layui-layer-iframe"]');
        if (!iframe) return;

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return;

        // 屏蔽 Alert
        if (iframe.contentWindow && !iframe.contentWindow.hasHookedAlert) {
            iframe.contentWindow.alert = function(msg) { console.log("拦截报错:", msg); };
            iframe.contentWindow.hasHookedAlert = true;
        }

        const inputs = doc.querySelectorAll('input[name="response"]');
        const submitBtn = doc.querySelector('.u-main-btn, .btn-submit');

        // 如果发现了题目，且还没有正在进行的点击任务
        if (inputs.length > 0 && submitBtn && !iframe.contentWindow.isAnswering) {
            
            iframe.contentWindow.isAnswering = true; // 标记正在答题，避免重复触发

            // 随机等待时间 (模拟读题)
            const thinkTime = Math.floor(Math.random() * (SAFETY_CONFIG.thinkTimeMax - SAFETY_CONFIG.minInterval + 1) + SAFETY_CONFIG.thinkTimeMin);
            console.log(`发现题目，假装思考 ${thinkTime}ms ...`);

            setTimeout(() => {
                // 思考结束，开始操作
                let checkedIndex = -1;
                for (let i = 0; i < inputs.length; i++) {
                    if (inputs[i].checked) { checkedIndex = i; break; }
                }

                // 盲猜下一个
                let nextIndex = (checkedIndex + 1) % inputs.length;
                
                // 模拟点击 Label
                const inputToClick = inputs[nextIndex];
                let clickable = inputToClick;
                if(inputToClick.parentElement && inputToClick.parentElement.tagName === 'STRONG') {
                    clickable = inputToClick.parentElement.parentElement;
                }
                clickable.click();
                inputToClick.click(); // 双保险

                // 再等一小会儿点提交
                setTimeout(() => {
                    console.log("提交答案");
                    submitBtn.click();
                    iframe.contentWindow.isAnswering = false; // 任务结束，释放锁
                }, 800);

            }, thinkTime);
        }
    }

    // --- 4. 进度跳转 ---
    function handleNext() {
        const currentSpan = document.getElementById('viewTimeTxt');
        if (!currentSpan) return;

        const parentP = currentSpan.parentElement;
        if (!parentP) return;
        
        const allSpans = parentP.querySelectorAll('span');
        if (allSpans.length < 2) return;

        const totalTime = parseInt(allSpans[0].innerText);
        const curTime = parseInt(currentSpan.innerText);
        const nextBtn = document.querySelector('.btn.next');

        // 判定完成
        if (!isNaN(totalTime) && !isNaN(curTime)) {
            if (curTime >= totalTime) {
                console.log("课程已达标，准备跳转...");
                if (nextBtn) {
                    nextBtn.click();
                } else {
                    try { if(typeof goNext === 'function') goNext(); } catch(e){}
                }
            }
        }
        
        // 视频播放结束兜底
        const video = document.querySelector('video');
        if (video && video.ended) {
             if(nextBtn) nextBtn.click();
        }
    }

})();