// ==UserScript==
// @name         广东省教师继续教育刷课助手-V8.1(答题修复+进度显示)
// @namespace    http://tampermonkey.net/
// @version      8.1
// @description  恢复精准答题逻辑、增加实时进度显示、音频伪装防冻结
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
        answerDelay: 1500,      // 答题思考时间
        reloadTimeout: 120,     // 卡顿刷新阈值
    };

    // ==========================================
    // MODULE: UI 面板 (修复进度显示)
    // ==========================================
    const infoBox = document.createElement('div');
    infoBox.id = 'tm-status-panel';
    infoBox.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 999999;
        background: rgba(20, 20, 20, 0.95);
        color: #fff;
        padding: 15px;
        border-radius: 8px;
        font-size: 13px;
        font-family: "Microsoft YaHei", sans-serif;
        box-shadow: 0 4px 15px rgba(0,0,0,0.6);
        border: 1px solid #444;
        min-width: 220px;
        line-height: 1.6;
    `;
    
    infoBox.innerHTML = `
        <div style="margin-bottom:8px; color:#00ff00; font-weight:bold; border-bottom:1px solid #555; padding-bottom:5px;">
            🤖 刷课助手 V8.1
        </div>
        
        <!-- 进度显示区域 -->
        <div id="tm-progress-box" style="margin-bottom:8px; font-size:14px;">
            已观看: <span id="tm-cur-min" style="color:#00ffff; font-weight:bold;">--</span> 分钟<br>
            总要求: <span id="tm-total-min" style="color:#aaa;">--</span> 分钟
        </div>

        <div id="tm-status" style="color:#orange; margin-bottom:8px;">⏳ 初始化中...</div>
        
        <button id="tm-activate" style="cursor:pointer; background:#d9534f; color:white; border:none; padding:6px 12px; border-radius:4px; width:100%; font-weight:bold;">
            🔇 点击激活后台模式
        </button>
    `;
    document.body.appendChild(infoBox);

    // 更新面板状态
    function updateStatus(msg, color = "#fff") {
        const el = document.getElementById('tm-status');
        if(el) {
            el.innerHTML = msg;
            el.style.color = color;
        }
    }

    // 更新进度数值 (专门解决你的痛点)
    function updateProgressUI() {
        const curSpan = document.getElementById('viewTimeTxt'); // 网页上的已看时间
        
        // 尝试获取总时间
        let totalTime = "--";
        if (curSpan && curSpan.parentElement) {
            const allSpans = curSpan.parentElement.querySelectorAll('span');
            if (allSpans.length >= 1) totalTime = allSpans[0].innerText;
        }
        
        // 更新到脚本面板
        document.getElementById('tm-cur-min').innerText = curSpan ? curSpan.innerText : "0";
        document.getElementById('tm-total-min').innerText = totalTime;
    }


    // ==========================================
    // MODULE: 音频伪装 (保留V7的后台能力)
    // ==========================================
    let audioContext;
    document.getElementById('tm-activate').onclick = function() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            audioContext = new AudioContext();
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.value = 100;
            gain.gain.value = 0.001;
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start();
            
            const btn = document.getElementById('tm-activate');
            btn.style.background = "#5cb85c";
            btn.innerText = "✅ 后台模式运行中";
            btn.disabled = true;
            
            // 顺便触发视频播放
            const video = document.querySelector('video');
            if(video) { video.muted = true; video.play(); }

        } catch (e) { console.error(e); }
    };


    // ==========================================
    // MODULE: 全局拦截 (防弹窗卡死)
    // ==========================================
    function hookAlert(win) {
        if (win && !win.hasHookedAlert) {
            win.alert = function(msg) { console.log("拦截Alert:", msg); };
            win.confirm = function() { return true; };
            win.hasHookedAlert = true;
        }
    }
    hookAlert(window);


    // ==========================================
    // 主循环
    // ==========================================
    let stuckCounter = 0;

    function gameLoop() {
        try {
            // 1. 更新UI进度 (每次循环都刷新)
            updateProgressUI();

            // 2. 优先处理答题
            const hasQuiz = handleQuiz();

            // 3. 如果没题，处理视频
            if (!hasQuiz) {
                handleVideo();
                handleNextCourse();
            }

        } catch (e) { console.error(e); }
        
        setTimeout(gameLoop, Math.random() * 2000 + CONFIG.scanInterval);
    }
    
    setTimeout(gameLoop, 2000);


    // ==========================================
    // 功能逻辑
    // ==========================================

    // --- 1. 答题逻辑 (回退到 V6/V7 的精准点击逻辑) ---
    function handleQuiz() {
        // 搜索所有环境
        const contexts = [{doc: document, win: window}];
        document.querySelectorAll('iframe').forEach(ifr => {
            try { if(ifr.contentDocument) contexts.push({doc: ifr.contentDocument, win: ifr.contentWindow}); } catch(e){}
        });

        for (const ctx of contexts) {
            hookAlert(ctx.win); // 确保 alert 被拦截

            const layer = ctx.doc.querySelector('.mylayer-wrap, .layui-layer');
            const inputs = ctx.doc.querySelectorAll('input[name="response"]');
            const submitBtn = ctx.doc.querySelector('.u-main-btn, .btn-submit');
            
            // 可见性检查
            const isVisible = layer ? (layer.style.display !== 'none' && layer.style.visibility !== 'hidden') : true;

            if (inputs.length > 0 && submitBtn && isVisible) {
                // 标记全局状态
                window.isAnsweringGlobal = true;

                if (!ctx.win.isHandlingQuiz) {
                    ctx.win.isHandlingQuiz = true;
                    updateStatus("📝 检测到题目，正在答题...", "#00ffff");

                    setTimeout(() => {
                        let checkedIndex = -1;
                        inputs.forEach((inp, i) => { if(inp.checked) checkedIndex = i; });
                        let nextIndex = (checkedIndex + 1) % inputs.length;

                        const targetInput = inputs[nextIndex];
                        
                        // === 关键修复：查找 .m-radio-tick 父级 ===
                        let clickTarget = targetInput;
                        // 1. 尝试找 .m-radio-tick
                        const tickLabel = targetInput.closest('.m-radio-tick');
                        // 2. 尝试找 strong 标签
                        const strongParent = targetInput.closest('strong');
                        
                        if (tickLabel) clickTarget = tickLabel;
                        else if (strongParent) clickTarget = strongParent;
                        else if (targetInput.parentElement) clickTarget = targetInput.parentElement;
                        
                        // 双重点击确保选中
                        clickTarget.click();
                        targetInput.click();

                        setTimeout(() => {
                            submitBtn.click();
                            ctx.win.isHandlingQuiz = false;
                            window.isAnsweringGlobal = false;
                        }, 800);
                    }, CONFIG.answerDelay);
                }
                return true; // 返回 true 表示正在处理题目
            }
        }
        window.isAnsweringGlobal = false;
        return false;
    }

    // --- 2. 视频逻辑 ---
    function handleVideo() {
        const video = document.querySelector('video');
        if (!video) {
            updateStatus("未检测到视频", "#aaa");
            return;
        }

        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;
        if (!video.muted) video.muted = true;

        if (video.paused) {
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
            if (playBtn && playBtn.offsetParent) playBtn.click();
            else video.play().catch(()=>{});

            stuckCounter++;
            updateStatus(`⏸️ 视频暂停 (${stuckCounter})`, "orange");
            
            // 只有当暂停很久，且不是因为答题时，才刷新
            if (stuckCounter * (CONFIG.scanInterval/1000) > CONFIG.reloadTimeout) {
                location.reload();
            }
        } else {
            stuckCounter = 0;
            // 这里的状态提示只是辅助，主要看上面的进度条区域
            updateStatus("▶️ 视频播放中", "#00ff00");
        }
    }

    // --- 3. 跳转逻辑 ---
    function handleNextCourse() {
        // 读取刚才更新到面板上的数据
        const curMin = parseInt(document.getElementById('tm-cur-min').innerText);
        const totalMin = parseInt(document.getElementById('tm-total-min').innerText);
        const video = document.querySelector('video');

        const isTimeDone = (!isNaN(curMin) && !isNaN(totalMin) && curMin >= totalMin);
        const isVideoDone = (video && video.ended);

        if (isTimeDone || isVideoDone) {
            updateStatus("✅ 本节完成，跳转中...", "#00ff00");
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