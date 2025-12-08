// ==UserScript==
// @name         广东省教师继续教育刷课助手-V6.1(修正不播版)
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  强制视频播放、并行处理答题、防误判、双域名适配
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @match        https://jsxx.gdedu.gov.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        scanInterval: 3000,
        answerDelay: 1500,
        reloadTimeout: 120, // 2分钟不动才刷新
    };

    // ==========================================
    // MODULE: 状态面板 + 强制启动按钮
    // ==========================================
    const infoBox = document.createElement('div');
    infoBox.id = 'tm-status-panel';
    infoBox.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        padding: 12px;
        border-radius: 8px;
        font-size: 13px;
        font-family: sans-serif;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        border: 1px solid #555;
        min-width: 180px;
    `;
    // 添加一个手动启动按钮，防止浏览器阻拦自动播放
    infoBox.innerHTML = `
        <div style="margin-bottom:5px; color:#00ff00; font-weight:bold;">🤖 刷课助手 V6.1</div>
        <div id="tm-msg">⏳ 初始化中...</div>
        <button id="tm-force-start" style="margin-top:5px; cursor:pointer; background:#007bff; color:white; border:none; padding:3px 8px; border-radius:3px;">▶ 强制开始播放</button>
    `;
    document.body.appendChild(infoBox);

    document.getElementById('tm-force-start').onclick = function() {
        const video = document.querySelector('video');
        if(video) {
            video.muted = true;
            video.play();
            updateStatus("已手动触发播放", "#00ff00");
        }
    };

    function updateStatus(msg, color = "#fff") {
        const el = document.getElementById('tm-msg');
        if(el) {
            el.innerHTML = msg;
            el.style.color = color;
        }
    }

    // ==========================================
    // MODULE: 全局 Alert 拦截
    // ==========================================
    function hookAlert(win) {
        if (win && !win.hasHookedAlert) {
            win.alert = console.log;
            win.confirm = () => true;
            win.hasHookedAlert = true;
        }
    }
    hookAlert(window);

    // ==========================================
    // 主逻辑 (并行架构)
    // ==========================================
    let stuckCounter = 0;

    function gameLoop() {
        try {
            // 1. 无论如何，都尝试维护视频 (解决不播放问题)
            handleVideo();

            // 2. 检测并处理答题 (如果有)
            handleQuiz();

            // 3. 检测进度跳转
            handleNextCourse();

        } catch (e) {
            console.error(e);
        }
        
        // 随机循环
        setTimeout(gameLoop, Math.random() * 2000 + CONFIG.scanInterval);
    }
    
    // 启动
    setTimeout(gameLoop, 2000);


    // ==========================================
    // 功能函数
    // ==========================================

    // --- 1. 视频控制 (强制优先) ---
    function handleVideo() {
        const video = document.querySelector('video');
        if (!video) {
            updateStatus("未检测到视频元素", "yellow");
            return;
        }

        // 基础设置
        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;
        if (!video.muted) video.muted = true;

        // 播放逻辑
        if (video.paused) {
            stuckCounter++;
            updateStatus(`⏸️ 视频暂停 (${stuckCounter})`, "orange");
            
            // 尝试多种方式启动
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
            
            // 策略：如果没在答题，就疯狂尝试播放
            const isAnswering = window.isAnsweringGlobal; // 全局锁
            
            if (!isAnswering) {
                if(playBtn && playBtn.offsetParent) {
                    playBtn.click();
                } else {
                    video.play().catch(e => {
                        updateStatus("⚠️ 自动播放被阻拦<br>请点击下方按钮", "#ff0000");
                    });
                }
            }
            
            // 防卡死刷新
            if (stuckCounter * (CONFIG.scanInterval/1000) > CONFIG.reloadTimeout) {
                location.reload();
            }
        } else {
            stuckCounter = 0;
            updateStatus(`▶️ 播放中: ${Math.floor(video.currentTime)}s`, "#00ff00");
        }
    }

    // --- 2. 答题逻辑 (修正误判) ---
    function handleQuiz() {
        // 定义检测范围：主页 + 所有iframe
        const contexts = [{doc: document, win: window}];
        document.querySelectorAll('iframe').forEach(ifr => {
            try { 
                if(ifr.contentDocument) contexts.push({doc: ifr.contentDocument, win: ifr.contentWindow});
            } catch(e){}
        });

        let foundQuiz = false;

        for (const ctx of contexts) {
            hookAlert(ctx.win);
            
            // 关键修正：检查容器是否可见
            // 你的弹窗容器类名是 .mylayer-wrap
            // 只有当 .mylayer-wrap 存在且 display != none 时才算有题
            const layer = ctx.doc.querySelector('.mylayer-wrap, .layui-layer');
            const inputs = ctx.doc.querySelectorAll('input[name="response"]');
            const submitBtn = ctx.doc.querySelector('.u-main-btn, .btn-submit');

            // 判定条件：有输入框 + 有提交按钮 + (弹窗层可见 或 找不到弹窗层但有输入框)
            const isLayerVisible = layer ? (layer.style.display !== 'none' && layer.style.visibility !== 'hidden') : true;

            if (inputs.length > 0 && submitBtn && isLayerVisible) {
                foundQuiz = true;
                
                // 标记全局状态，告诉视频模块"别急，先做题"
                window.isAnsweringGlobal = true; 

                if (!ctx.win.isHandlingQuiz) {
                    ctx.win.isHandlingQuiz = true;
                    updateStatus("📝 正在答题...", "#00ffff");

                    setTimeout(() => {
                        let checkedIndex = -1;
                        inputs.forEach((inp, i) => { if(inp.checked) checkedIndex = i; });
                        let nextIndex = (checkedIndex + 1) % inputs.length;

                        const target = inputs[nextIndex];
                        // 点击 Label
                        let clickTarget = target;
                        if (target.closest('.m-radio-tick')) clickTarget = target.closest('.m-radio-tick');
                        else if (target.parentElement.tagName === 'STRONG') clickTarget = target.parentElement.parentElement;
                        
                        clickTarget.click();
                        target.click();

                        setTimeout(() => {
                            submitBtn.click();
                            ctx.win.isHandlingQuiz = false;
                            window.isAnsweringGlobal = false;
                        }, 800);
                    }, CONFIG.answerDelay);
                }
                break; // 找到一个就处理，退出循环
            }
        }
        
        if(!foundQuiz) {
            window.isAnsweringGlobal = false;
        }
    }

    // --- 3. 跳转逻辑 ---
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
            updateStatus("✅ 本节完成，跳转中...", "#00ff00");
            const nextBtn = document.querySelector('.btn.next');
            if (nextBtn && !nextBtn.classList.contains('disabled')) {
                nextBtn.click();
            } else {
                // 侧边栏跳转
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