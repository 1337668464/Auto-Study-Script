// ==UserScript==
// @name         广东省教师继续教育刷课助手-V3.0(全自动版)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  自动静音播放、自动点击“继续学习”、自动盲猜答题(拦截报错)、自动跳转
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === 配置区域 ===
    const CONFIG = {
        checkInterval: 3000,    // 检查频率 3秒
        reloadThreshold: 120,   // 视频卡死120秒后刷新
        randomDelay: 1000,      // 答题时的随机延迟，防检测
    };

    let lastTime = -1;
    let stuckCount = 0;

    console.log("刷课脚本 V3.0 已启动 - 全自动模式");

    // 主循环
    setInterval(() => {
        try {
            // 1. 视频维护
            handleVideo();
            // 2. 防挂机提示
            handleAntiIdle();
            // 3. 自动答题 (核心更新)
            handleQuiz();
            // 4. 进度与跳转
            handleNext();
        } catch (e) {
            console.error("循环异常:", e);
        }
    }, CONFIG.checkInterval);

    // --- 1. 视频处理 ---
    function handleVideo() {
        const video = document.querySelector('video');
        if (!video) return;

        // 强制静音 (静音才能自动播放)
        if (!video.muted) video.muted = true;

        // 自动播放
        if (video.paused) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // 如果代码播放失败，尝试点击页面上的播放/暂停按钮
                    const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
                    if(playBtn) playBtn.click();
                });
            }
        }

        // 卡顿检测
        if (Math.abs(video.currentTime - lastTime) < 0.1) {
            stuckCount++;
            if (stuckCount > (CONFIG.reloadThreshold / 3)) {
                console.log("视频长时间未动，刷新页面...");
                location.reload();
            }
        } else {
            lastTime = video.currentTime;
            stuckCount = 0;
        }
    }

    // --- 2. 防挂机弹窗 ---
    function handleAntiIdle() {
        // 匹配 "继续学习" 按钮
        const btn = document.querySelector('.mylayer-btn3');
        if (btn) {
            console.log("检测到防挂机弹窗，点击继续...");
            btn.click();
        }
    }

    // --- 3. 自动答题 (核心) ---
    function handleQuiz() {
        // 1. 寻找 Layer 弹窗的 Iframe
        const iframe = document.querySelector('iframe[id^="layui-layer-iframe"]');
        if (!iframe) return; // 没弹窗就退出

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return;

        // 2. 屏蔽 Alert (关键！防止答错弹窗卡死浏览器)
        if (iframe.contentWindow && !iframe.contentWindow.hasHookedAlert) {
            iframe.contentWindow.alert = function(msg) {
                console.log("已拦截弹窗警告:", msg);
                // 可以在这里加个标记，告诉脚本刚才选错了
            };
            iframe.contentWindow.hasHookedAlert = true;
            console.log("成功注入 Iframe 屏蔽 Alert");
        }

        // 3. 获取所有选项和提交按钮
        // 根据你提供的 HTML，选项 input 的 name 是 "response"
        const inputs = doc.querySelectorAll('input[name="response"]');
        const submitBtn = doc.querySelector('.u-main-btn, .btn-submit');

        if (inputs.length > 0 && submitBtn) {
            console.log(`发现题目，共 ${inputs.length} 个选项`);

            // 逻辑：寻找当前选中的，然后选它的下一个。如果都没选，选第一个。
            let checkedIndex = -1;
            for (let i = 0; i < inputs.length; i++) {
                if (inputs[i].checked) {
                    checkedIndex = i;
                    break;
                }
            }

            // 计算应该点哪一个
            let nextIndex = 0;
            if (checkedIndex !== -1) {
                // 如果已经选中了一个（说明上次提交错了），那就选下一个
                nextIndex = (checkedIndex + 1) % inputs.length;
                console.log(`上次选了第 ${checkedIndex + 1} 个，这次尝试第 ${nextIndex + 1} 个`);
            } else {
                console.log("首次答题，选择第 1 个");
            }

            // 执行点击 (建议点击 input 的父级 label，因为 input 可能被隐藏)
            const inputToClick = inputs[nextIndex];
            // 向上找 label 或者 li 标签点击，确保触发网页的选中效果
            let clickable = inputToClick;
            if(inputToClick.parentElement && inputToClick.parentElement.tagName === 'STRONG') {
                clickable = inputToClick.parentElement.parentElement; // 对应 label.m-radio-tick
            }
            
            clickable.click();
            // 双保险：直接点 input
            inputToClick.click();

            // 提交
            setTimeout(() => {
                console.log("点击提交...");
                submitBtn.click();
            }, 500); // 稍微延迟一下，模拟人类操作
        }
    }

    // --- 4. 进度监控与下一课 ---
    function handleNext() {
        // 获取进度文本
        const currentSpan = document.getElementById('viewTimeTxt'); // 当前分钟
        if (!currentSpan) return;

        // 你的HTML结构是: 要求观看视频<span>47</span>分钟 ... 您已观看<span id="viewTimeTxt">13</span>分钟
        // 所以 currentSpan 的父级的第一个 span 就是总时间
        const parentP = currentSpan.parentElement;
        if (!parentP) return;
        
        const allSpans = parentP.querySelectorAll('span');
        if (allSpans.length < 2) return;

        const totalTime = parseInt(allSpans[0].innerText);
        const curTime = parseInt(currentSpan.innerText);

        // 获取下一页按钮
        const nextBtn = document.querySelector('.btn.next');

        // 判定完成
        if (!isNaN(totalTime) && !isNaN(curTime)) {
            if (curTime >= totalTime) {
                console.log(`进度满足 (${curTime}/${totalTime})，尝试跳转...`);
                if (nextBtn) {
                    nextBtn.click();
                } else {
                    // 尝试直接调用网页函数
                    try { if(typeof goNext === 'function') goNext(); } catch(e){}
                }
            }
        }
        
        // 备用逻辑：如果视频播放完了 (ended)，也尝试跳转
        const video = document.querySelector('video');
        if (video && video.ended) {
             console.log("视频播放结束，尝试跳转...");
             if(nextBtn) nextBtn.click();
        }
    }

})();