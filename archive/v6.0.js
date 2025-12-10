// ==UserScript==
// @name         广东省教师继续教育刷课助手-V6.0(进度解锁版)
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  全域答题搜索、拦截Alert、解锁进度条、防掉线、自动跳转
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @match        https://jsxx.gdedu.gov.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === 配置区域 ===
    const CONFIG = {
        scanInterval: 3000,     // 扫描频率
        answerDelay: 2000,      // 发现题目后，思考多久再答
        reloadTimeout: 90,      // 如果卡住超过90秒，刷新页面
    };

    // ==========================================
    // MODULE: 状态面板
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
        pointer-events: none; 
    `;
    infoBox.innerHTML = "🤖 V6.0 进度解锁版初始化...";
    document.body.appendChild(infoBox);

    function updateStatus(msg, color = "#00ff00") {
        infoBox.style.color = color;
        infoBox.innerHTML = `🤖 刷课助手 V6.0<br>${msg}`;
    }

    // ==========================================
    // MODULE: 全局 Alert 拦截 (防止弹窗卡死)
    // ==========================================
    function hookAlert(win) {
        if (win && !win.hasHookedAlert) {
            win.alert = function(text) {
                console.log("拦截到网页Alert:", text);
                updateStatus(`🛡️ 拦截报错: ${text}`, "orange");
            };
            win.confirm = function(text, cb1, cb2) {
                console.log("拦截到网页Confirm:", text);
                if(typeof cb1 === 'function') cb1(); // 默认确认
                return true;
            };
            win.hasHookedAlert = true;
        }
    }
    // 先拦截主页面的
    hookAlert(window);

    // ==========================================
    // 主逻辑
    // ==========================================
    let stuckCounter = 0;

    function gameLoop() {
        try {
            // 1. 全域搜索题目 (主页面 + Iframe)
            const quizContext = findQuizContext();

            if (quizContext) {
                // === A. 发现题目模式 ===
                stuckCounter = 0; // 重置卡顿计数
                solveQuiz(quizContext); // 答题
            } else {
                // === B. 正常观看模式 ===
                handleVideo();
                handleNextCourse();
            }

        } catch (e) {
            console.error("循环异常:", e);
        }

        setTimeout(gameLoop, Math.random() * 2000 + CONFIG.scanInterval);
    }

    setTimeout(gameLoop, 2000);

    // ==========================================
    // 核心功能函数
    // ==========================================

    // --- 1. 全域寻找题目所在的环境 (关键更新) ---
    function findQuizContext() {
        // 1.1 先查主页面
        let submitBtn = document.querySelector('.u-main-btn, .btn-submit, onclick*="finishTest"');
        let inputs = document.querySelectorAll('input[name="response"]');
        if (inputs.length > 0 && submitBtn && isVisible(submitBtn)) {
            return { doc: document, win: window, type: 'main' };
        }

        // 1.2 再查所有 Iframe
        const iframes = document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            try {
                let doc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                if (!doc) continue;
                
                // 顺便把 iframe 里的 alert 也拦截了
                hookAlert(iframes[i].contentWindow);

                let subSubmit = doc.querySelector('.u-main-btn, .btn-submit');
                let subInputs = doc.querySelectorAll('input[name="response"]');
                if (subInputs.length > 0 && subSubmit) {
                    return { doc: doc, win: iframes[i].contentWindow, type: 'iframe' };
                }
            } catch (e) { /* 跨域忽略 */ }
        }
        return null;
    }

    // 判断元素是否可见 (防止抓到隐藏的弹窗)
    function isVisible(elem) {
        return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
    }

    // --- 2. 答题逻辑 (精准点击) ---
    function solveQuiz(ctx) {
        updateStatus(`📝 检测到题目 (${ctx.type})<br>正在尝试解锁进度...`, "#00ffff");

        const doc = ctx.doc;
        const win = ctx.win;

        // 防止重复点击
        if (win.isAnswering) return;
        win.isAnswering = true;

        setTimeout(() => {
            const inputs = doc.querySelectorAll('input[name="response"]');
            const submitBtn = doc.querySelector('.u-main-btn, .btn-submit');

            if (!submitBtn) { win.isAnswering = false; return; }

            // 1. 查找当前是否已选
            let checkedIndex = -1;
            inputs.forEach((inp, i) => { if (inp.checked) checkedIndex = i; });

            // 2. 决定点哪一个 (轮询)
            let nextIndex = 0;
            if (checkedIndex !== -1) {
                // 如果已经有选中的，说明上次错了，选下一个
                nextIndex = (checkedIndex + 1) % inputs.length;
            }

            // 3. 执行点击
            // 根据你的HTML：input 在 label.m-radio-tick 里面
            const targetInput = inputs[nextIndex];
            
            // 关键：寻找父级 label 点击，触发网页事件
            let clickTarget = targetInput;
            let parentLabel = targetInput.closest('.m-radio-tick'); 
            if (parentLabel) {
                clickTarget = parentLabel; // 优先点 label
            }

            // 模拟双重点击
            clickTarget.click();
            targetInput.click(); 

            // 4. 提交
            setTimeout(() => {
                updateStatus("📤 提交答案...", "#00ffff");
                submitBtn.click();
                win.isAnswering = false; // 释放锁
            }, 800);

        }, CONFIG.answerDelay);
    }

    // --- 3. 视频控制 (仅在无题时运行) ---
    function handleVideo() {
        const video = document.querySelector('video');
        if (!video) {
            updateStatus("⏳ 等待视频加载...", "yellow");
            return;
        }

        // 检测长时间卡顿 (防掉线)
        if (video.paused) {
            stuckCounter++;
            updateStatus(`⚠️ 视频暂停中 (等待题目?)<br>防卡死倒计时: ${CONFIG.reloadTimeout - (stuckCounter * 3)}s`, "orange");
            
            // 尝试播放（万一不是因为题目暂停的）
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
            if(playBtn && playBtn.offsetParent) playBtn.click();
            else video.play().catch(()=>{});

            if (stuckCounter * 3 > CONFIG.reloadTimeout) {
                location.reload();
            }
        } else {
            stuckCounter = 0;
            updateStatus(`▶️ 正在播放 | 进度: ${Math.floor(video.currentTime)}s`);
        }

        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;
        if (!video.muted) video.muted = true;
    }

    // --- 4. 跳转 ---
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
            updateStatus("✅ 任务完成，跳转下一节...", "#00ff00");
            
            const nextBtn = document.querySelector('.btn.next');
            if (nextBtn && !nextBtn.classList.contains('disabled')) {
                nextBtn.click();
            } else {
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
    }

})();