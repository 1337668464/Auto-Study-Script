// ==UserScript==
// @name         广东省教师继续教育刷课助手-基础版
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  自动看课、自动答题（盲选）、自动下一课
// @author       You & AI
// @match        https://jsglpt.gdedu.gov.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 配置参数
    const CONFIG = {
        checkInterval: 3000, // 每3秒检查一次状态
        videoMute: true,     // 默认静音，防止打扰
    };

    console.log("刷课脚本已启动...");

    // 主循环
    setInterval(() => {
        try {
            handleVideo();
            handlePopup();
            handleNext();
        } catch (e) {
            console.error("脚本运行出错:", e);
        }
    }, CONFIG.checkInterval);

    // --- 模块1：视频处理 ---
    function handleVideo() {
        // 查找网页中的视频标签
        let video = document.querySelector('video');
        if (video) {
            // 静音
            if (CONFIG.videoMute && !video.muted) {
                video.muted = true;
                console.log("视频已自动静音");
            }
            // 播放
            if (video.paused) {
                video.play();
                console.log("视频已自动开始播放");
            }
        }
    }

    // --- 模块2：弹窗答题处理 (核心难点，需要你提供HTML修正) ---
    function handlePopup() {
        // 假设弹窗的特征（这里全是猜测，需要替换）
        // 这里我写一段通用逻辑，试图寻找网页里突然出现的“选项”和“确认按钮”

        // 1. 寻找可能的弹窗容器（这一步如果不准，后面都没法跑）
        // 常见的弹窗class可能是 dialog, modal, window, layui-layer 等
        // 这里只是示例，大概率找不到，需要你提供F12信息
        let popup = document.querySelector('.dialog, .modal-content, .layui-layer-content');

        if (popup && popup.offsetParent !== null) { // 弹窗可见
            console.log("检测到弹窗！尝试答题...");

            // 寻找选项（通常是 radio 或 checkbox，或者是 li 标签）
            let options = popup.querySelectorAll('input[type="radio"], input[type="checkbox"], .option-item');

            // 寻找确认按钮
            let confirmBtn = popup.querySelector('.btn-submit, .btn-ok, button[type="button"]');

            if (options.length > 0) {
                // 策略：总是先选第1个（如果有），如果没反应下一次循环可能需要逻辑判断
                // 但由于每3秒循环一次，这里我们简单粗暴：随机点一个，或者点第一个
                if (!options[0].checked) {
                    options[0].click(); 
                    console.log("已点击第1个选项");
                }
            }

            if (confirmBtn) {
                confirmBtn.click();
                console.log("已点击确认/提交按钮");
            }
        }
    }

    // --- 模块3：自动跳转 ---
    function handleNext() {
        // 根据你提供的HTML：<a href="javascript:;" onclick="goNext()" class="btn next crt">
        // 这里的 class="btn next crt" 是关键
        let nextBtn = document.querySelector('.btn.next');

        // 有些网站，按钮虽然在，但是是灰色的（不可点），通常会有 disabled 属性或特定样式
        // 这里先假设只有变成可点击状态我们才点。
        // 通常未看完时，视频会播放，我们需要判断视频是否结束，或者直接检测按钮是否"高亮"
        
        // 简单的判断：如果视频结束了，或者进度条满了（需要你提供进度条HTML）
        let video = document.querySelector('video');
        if (video && video.ended) {
            console.log("视频播放结束，准备跳转...");
            if (nextBtn) {
                nextBtn.click();
                console.log("点击了下一页");
            }
        }
    }

})();