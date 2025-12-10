// ==UserScript==
// @name         广东省教师继续教育刷课助手-V8.0(Worker内核防冻结版)
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Web Worker内核驱动、全域答题、双域名适配、彻底解决后台节流问题
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @match        https://jsxx.gdedu.gov.cn/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // === 核心配置 ===
    const CONFIG = {
        scanInterval: 3000,     // 扫描检测频率 (毫秒)
        answerDelay: 1500,      // 发现题目后的思考时间
        reloadThreshold: 120,   // 卡顿容忍时长 (秒)
    };

    // ==========================================
    // MODULE 1: UI 面板 & 启动控制器
    // ==========================================
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed; top: 10px; left: 10px; z-index: 999999;
        background: rgba(20, 20, 20, 0.95); color: #fff;
        padding: 15px; border-radius: 8px; font-size: 13px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6); border: 1px solid #444;
        width: 200px; font-family: sans-serif;
    `;
    panel.innerHTML = `
        <div style="font-weight:bold; color:#00ff00; margin-bottom:10px;">🤖 V8.0 Worker 内核版</div>
        <div id="tm-status" style="color:#aaa; margin-bottom:10px;">⏳ 等待手动激活...</div>
        <button id="tm-start-btn" style="width:100%; padding:8px; background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
            🚀 点击启动挂机系统
        </button>
    `;
    document.body.appendChild(panel);

    const statusEl = document.getElementById('tm-status');
    const btnEl = document.getElementById('tm-start-btn');

    function updateStatus(msg, color = '#fff') {
        statusEl.innerHTML = msg;
        statusEl.style.color = color;
    }

    // ==========================================
    // MODULE 2: Web Worker (防冻结心脏)
    // ==========================================
    // 创建一个 Blob，里面包含 Worker 的代码。Worker 运行在独立线程。
    const workerScript = `
        self.onmessage = function(e) {
            if (e.data === 'start') {
                // 在 Worker 线程里跑定时器，浏览器无法对它进行后台节流
                setInterval(() => {
                    self.postMessage('tick');
                }, ${CONFIG.scanInterval});
            }
        };
    `;
    const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    const timerWorker = new Worker(workerUrl);

    // ==========================================
    // MODULE 3: 强力事件拦截 (隐身模式)
    // ==========================================
    function enableStealthMode() {
        try {
            // 1. 属性欺骗
            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

            // 2. 劫持 addEventListener (从根源阻止网页检测切屏)
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                // 如果网页想监听这些事件，直接忽略
                if (['visibilitychange', 'webkitvisibilitychange', 'blur', 'pagehide'].includes(type)) {
                    console.log(`🛡️ V8已拦截恶意监控事件: ${type}`);
                    return;
                }
                return originalAddEventListener.apply(this, arguments);
            };
            console.log("✅ 隐身模式已激活");
        } catch (e) {
            console.error("隐身模式激活失败", e);
        }
    }

    // ==========================================
    // MODULE 4: 音频保活 & 系统启动
    // ==========================================
    let audioCtx;

    btnEl.onclick = function() {
        try {
            // 1. 启动音频上下文 (骗取浏览器高优先级)
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 200; // 频率随便
            gain.gain.value = 0.001;   // 极低音量

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();

            // 2. 启动 Worker 计时器
            timerWorker.postMessage('start');

            // 3. 激活隐身拦截
            enableStealthMode();

            // 更新 UI
            btnEl.innerText = "✅ 系统运行中 (可最小化)";
            btnEl.style.background = "#5cb85c";
            btnEl.disabled = true;
            updateStatus("🔊 音频+Worker 双重保活", "#00ff00");

            // 顺手触发一次播放
            const video = document.querySelector('video');
            if(video) { video.muted = true; video.play().catch(()=>{}); }

        } catch (e) {
            alert("启动失败: " + e.message);
        }
    };

    // ==========================================
    // 主逻辑 (由 Worker 的 'tick' 信号驱动)
    // ==========================================
    let stuckCounter = 0;

    timerWorker.onmessage = function(e) {
        if (e.data === 'tick') {
            // 收到 Worker 的信号，执行一次检查
            try {
                // 1. 优先答题
                const hasQuiz = processQuiz();

                // 2. 如果没答题，维护视频
                if (!hasQuiz) {
                    processVideo();
                    processNext();
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    // --- 功能 A: 视频维护 ---
    function processVideo() {
        const video = document.querySelector('video');
        if (!video) return;

        if (video.playbackRate !== 1.0) video.playbackRate = 1.0;
        if (!video.muted) video.muted = true;

        if (video.paused) {
            // 尝试点击播放按钮
            const playBtn = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
            if (playBtn && playBtn.offsetParent) playBtn.click();
            else video.play().catch(()=>{});

            stuckCounter++;
            updateStatus(`⏸️ 视频暂停 (${stuckCounter})`, "orange");

            if (stuckCounter * (CONFIG.scanInterval/1000) > CONFIG.reloadThreshold) {
                location.reload();
            }
        } else {
            stuckCounter = 0;
            updateStatus(`▶️ 播放中: ${Math.floor(video.currentTime)}s`, "#00ff00");
        }
    }

    // --- 功能 B: 全域答题 ---
    function processQuiz() {
        // 搜索主页面和iframe
        const contexts = [{doc: document, win: window}];
        document.querySelectorAll('iframe').forEach(ifr => {
            try { if(ifr.contentDocument) contexts.push({doc: ifr.contentDocument, win: ifr.contentWindow}); } catch(e){}
        });

        for (const ctx of contexts) {
            // 拦截 alert
            if(!ctx.win.hooked) {
                ctx.win.alert = console.log;
                ctx.win.confirm = () => true;
                ctx.win.hooked = true;
            }

            // 查找题目元素
            const layer = ctx.doc.querySelector('.mylayer-wrap, .layui-layer');
            const inputs = ctx.doc.querySelectorAll('input[name="response"]');
            const submitBtn = ctx.doc.querySelector('.u-main-btn, .btn-submit');

            // 判定题目是否出现 (可见性检查)
            const isVisible = layer ? (layer.style.display !== 'none' && layer.style.visibility !== 'hidden') : true;

            if (inputs.length > 0 && submitBtn && isVisible) {
                if (!window.isGlobalAnswering) {
                    window.isGlobalAnswering = true;
                    updateStatus("📝 正在答题...", "#00ffff");

                    setTimeout(() => {
                        let checkedIndex = -1;
                        inputs.forEach((inp, i) => { if(inp.checked) checkedIndex = i; });
                        let nextIndex = (checkedIndex + 1) % inputs.length;

                        const target = inputs[nextIndex];
                        // 尝试点击 label
                        let clickTarget = target;
                        if (target.closest('.m-radio-tick')) clickTarget = target.closest('.m-radio-tick');
                        else if (target.parentElement.tagName === 'STRONG') clickTarget = target.parentElement.parentElement;

                        clickTarget.click();
                        target.click();

                        setTimeout(() => {
                            submitBtn.click();
                            window.isGlobalAnswering = false;
                        }, 800);
                    }, CONFIG.answerDelay);
                }
                return true; // 告诉主逻辑正在答题，暂停视频处理
            }
        }
        window.isGlobalAnswering = false;
        return false;
    }

    // --- 功能 C: 跳转 ---
    function processNext() {
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
            updateStatus("✅ 跳转下一节...", "#00ff00");
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