// ==UserScript==
// @name         广东省教师继续教育刷课助手-V2.0
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  自动静音播放、自动点击“继续学习”、自动答题(适配Iframe)、自动下一课
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === 配置区域 ===
    const CONFIG = {
        checkInterval: 3000,    // 主循环周期 3秒
        reloadThreshold: 60,    // 如果视频卡住60秒没动，刷新页面
    };

    // 状态记录
    let lastTime = -1;
    let stuckCount = 0;

    console.log("刷课脚本 V2.0 已启动");

    // 主定时器
    setInterval(() => {
        try {
            // 1. 处理视频（静音、播放、防暂停）
            handleVideo();

            // 2. 处理“继续学习”防挂机弹窗
            handleAntiIdle();

            // 3. 处理答题弹窗（核心难点，适配Iframe）
            handleQuiz();

            // 4. 处理进度与自动下一课
            handleProgressAndNext();

        } catch (e) {
            console.error("脚本主循环错误:", e);
        }
    }, CONFIG.checkInterval);


    // ================= 功能函数实现 =================

    // --- 1. 视频控制 ---
    function handleVideo() {
        const video = document.querySelector('video');
        if (!video) return;

        // 静音 (必须静音，否则浏览器可能阻止自动播放)
        if (!video.muted) {
            video.muted = true;
            console.log("已自动静音");
        }

        // 播放
        if (video.paused) {
            // 尝试点击网页自带的播放按钮（如果有），没有则通过代码播放
            // 你提供的代码里有 .playchzqozkmgsbb 这种乱码类名，不太稳定，直接操作 video 元素更稳
            let playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log("自动播放被阻止，尝试点击播放器中心...");
                    // 尝试点击暂停图标
                    let pauseIcon = document.querySelector('.pausecenterchzqozkmgsbb, .pausechzqozkmgsbb');
                    if(pauseIcon) pauseIcon.click();
                });
            }
            console.log("检测到暂停，尝试恢复播放");
        }

        // 卡顿检测
        if (video.currentTime === lastTime) {
            stuckCount++;
            if (stuckCount > CONFIG.reloadThreshold / 3) { // 约60秒
                console.log("视频似乎卡住了，刷新页面...");
                location.reload();
            }
        } else {
            lastTime = video.currentTime;
            stuckCount = 0;
        }
    }

    // --- 2. 防挂机弹窗 ---
    function handleAntiIdle() {
        // 根据你提供的JS代码：classname:'mylayer-btn3' 是“继续学习”按钮
        const continueBtn = document.querySelector('.mylayer-btn3');
        if (continueBtn) {
            console.log("检测到‘继续学习’弹窗，自动点击...");
            continueBtn.click();
        }
    }

    // --- 3. 答题弹窗 (重点：Iframe穿透) ---
    function handleQuiz() {
        // 寻找弹窗的 Iframe
        // Layui 的 iframe 弹窗通常有一个 layer-iframe 类的 iframe
        const iframe = document.querySelector('iframe[id^="layui-layer-iframe"]');

        if (iframe) {
            try {
                // 尝试获取 iframe 内部文档
                const innerDoc = iframe.contentDocument || iframe.contentWindow.document;

                if (innerDoc) {
                    console.log("发现答题弹窗 Iframe，正在尝试答题...");

                    // 寻找选项：通常是 radio 或者 checkbox
                    // 这里需要盲猜一下 iframe 里的结构。
                    // 常见的选项容器：input[type=radio], .option, .radio
                    const options = innerDoc.querySelectorAll('input[type="radio"], input[type="checkbox"], .radio-item, li.item');
                    const submitBtn = innerDoc.querySelectorAll('.btn-submit, .submit, .btn-blue, button[type="submit"], #submit'); // 猜的提交按钮

                    // 简单的答题逻辑：
                    // 如果没有选中的，就随机选一个，然后点提交
                    // 如果已经选过且提交了（可能是错的），就换一个选
                    
                    if (options.length > 0) {
                        // 策略：总是点击第一个未被选中的，或者随机点击
                        // 现在的逻辑：随便点一个没被选中的
                        let hasChecked = false;
                        for(let i=0; i<options.length; i++){
                             if(options[i].checked || options[i].classList.contains('checked')) {
                                 hasChecked = true;
                                 break;
                             }
                        }

                        if(!hasChecked) {
                            console.log("点击第一个选项...");
                            options[0].click(); // 点击第一个
                        } else {
                             // 如果已经有点过的（可能是上次答错提示错误），尝试点第二个
                             if(options.length > 1 && !options[1].checked) {
                                  // 这里逻辑比较简单，先试着不断提交
                             }
                        }

                        // 寻找并点击提交按钮
                        // 由于我不确定提交按钮的具体 HTML，尝试查找所有按钮并遍历点击包含“提交”“确定”字样的
                        const allBtns = innerDoc.querySelectorAll('a, button, .btn');
                        allBtns.forEach(btn => {
                            if (btn.innerText.includes("提交") || btn.innerText.includes("确定") || btn.innerText.includes("答案")) {
                                console.log("点击提交按钮:", btn.innerText);
                                btn.click();
                            }
                        });
                    }
                }
            } catch (err) {
                // 跨域限制会报错，但如果是同源（通常是同源）则不会
                console.log("访问 Iframe 内容受限或出错: " + err);
            }
        }
    }

    // --- 4. 进度监控与下一课 ---
    function handleProgressAndNext() {
        // 获取当前观看时间
        const viewedSpan = document.getElementById('viewTimeTxt');
        
        // 获取总时间：viewedSpan 的父元素 p，里面的第一个 span
        // 结构：<p>要求观看视频<span>47</span>分钟 ... <span id="viewTimeTxt">13</span> ...</p>
        if (viewedSpan && viewedSpan.parentElement) {
            const spans = viewedSpan.parentElement.querySelectorAll('span');
            if (spans.length >= 2) {
                const totalMin = parseInt(spans[0].innerText); // 第一个是总时间
                const currentMin = parseInt(viewedSpan.innerText); // 第二个是当前时间（也是id=viewTimeTxt那个）

                // 只有当数字有效时
                if (!isNaN(totalMin) && !isNaN(currentMin)) {
                    // console.log(`进度监控: ${currentMin} / ${totalMin} 分钟`);

                    // 如果当前时间 >= 总时间
                    if (currentMin >= totalMin) {
                        console.log("判断课程已完成，准备跳转...");
                        
                        // 尝试点击“下一个活动”
                        // 代码里是 <a href="javascript:;" onclick="goNext()" class="btn next crt">
                        const nextBtn = document.querySelector('.btn.next');
                        
                        if (nextBtn) {
                            // 检查是否是被禁用的样式（有时会是 .disabled）
                            // 你的代码里可点击是 .crt，不可点击可能没有 .crt，或者有其他样式
                            // 这里我们直接尝试点击，或者调用 goNext() 函数
                            
                            nextBtn.click();
                            
                            // 双重保险：尝试调用页面原生函数
                            try {
                                if (typeof unsafeWindow !== 'undefined' && unsafeWindow.goNext) {
                                    unsafeWindow.goNext();
                                } else if (window.goNext) {
                                    window.goNext();
                                }
                            } catch(e) {}
                        }
                    }
                }
            }
        }
    }

})();