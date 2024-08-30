// ==UserScript==
// @name         Batch Downloader For SurfShark Wireguard Configuration
// @namespace    http://tampermonkey.net/
// @version      2024-08-30
// @description  打包下载SurfShark官网提供的Wireguard配置文件
// @author       ZMao
// @match        https://my.shark-china.com/vpn/manual-setup/main/wireguard?country=CN&referrer=%2Fvpn%2Fmanual-setup%2Fmain%2Fwireguard&restricted=
// @icon         https://www.google.com/s2/favicons?sz=64&domain=shark-china.com
// @grant        unsafeWindow
// @license      MIT
// ==/UserScript==
 
(async function() {
    'use strict';
 
  // load script
  const JSZip_URL =
    "https://cdn.bootcdn.net/ajax/libs/jszip/3.10.1/jszip.min.js";
  const FILE_SAVER_URL =
    "https://cdn.bootcdn.net/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js";
  async function loadScript(url, name) {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = url;
      document.head.appendChild(script);
      script.onload = () => resolve(name);
    });
  }
  console.log(await loadScript(JSZip_URL, "JSZip"), "Loaded");
  console.log(await loadScript(FILE_SAVER_URL, "FileSaver"), "Loaded");
 
  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
 
  async function waitForDom(selector, all) {
    const WAIT_TIME = 200;
    const MAX_TIME_OUT = 5000;
    let elapsed = 0;
    while (true) {
      await sleep(WAIT_TIME);
      let el;
      if (all) {
        el = document.querySelectorAll(selector);
        if (!el.length) {
          el = null;
        }
      } else {
        el = document.querySelector(selector);
      }
      if (el) return el;
      elapsed += WAIT_TIME;
      if (elapsed > MAX_TIME_OUT) {
        throw new ReferenceError(`Element ${selector} not found`);
      }
    }
  }
 
  // get files
  const BTN_CLS = ".FDHlS.BoKAf";
  const INFO_CLS = ".SypSc";
  const CLOSE_CLS = ".qrJVt";
  const CONTAINER_CLS = ".HTmxn";
  const DOWN_BTN_CLS = ".FDHlS.BoKAf [data-test=menu-list-item-action]";
  const REGIONS = ["tw-tai", "jp-tok", "th-bkk", "us-hou", "uk-man", "hk-hkg"];
  const endpoints = [];
  const files = [];
 
  const container = await waitForDom(CONTAINER_CLS);
  const downDiv = document.createElement("div");
  downDiv.className = "FDHlS BoKAf";
  const downBtn = (await waitForDom(DOWN_BTN_CLS)).cloneNode(true);
  downDiv.innerHTML =
    "<div style='margin-right: auto'>打包下载所有配置文件</div>";
  downDiv.addEventListener("click", run);
  downDiv.appendChild(downBtn);
  container.appendChild(downDiv);
 
  async function run() {
    // set private key
    let privateKey = unsafeWindow.localStorage.getItem("privateKey");
    const prompt = "请填写Private Key";
    privateKey = unsafeWindow.prompt(prompt, privateKey);
    console.log(privateKey);
    if (!privateKey || privateKey === "null") {
      throw new Error("Private key is missing");
    }
    unsafeWindow.localStorage.setItem("privateKey", privateKey);
 
    for (let [regionIdx, btn] of [...document.querySelectorAll(BTN_CLS)]
      .slice(0, -1)
      .entries()) {
      btn.click();
      const info = await waitForDom(INFO_CLS, true);
      const [ip, pubKey] = [...info].slice(1).map((item) => item.textContent);
      waitForDom(CLOSE_CLS)
        .then((btn) => btn.click())
        .catch((err) => {
          console.log(err);
          throw err;
        });
      const connectionName = REGIONS[regionIdx] + ".prod.surfshark.com";
      console.log("Getting", connectionName);
      const resRaw = await fetch("https://my.shark-china.com/vpn/wg-config", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pubKey, ip, connectionName }),
        method: "POST",
      });
      if (resRaw.ok) {
        const text = await resRaw.text();
        endpoints.push(text.split("Endpoint =")[1].trim());
        files.push(text.replace("<insert_your_private_key_here>", privateKey));
      } else {
        throw new Error(`${resRaw.status} ${resRaw.statusText}`);
      }
    }
    console.log(endpoints);
 
    const zip = new JSZip();
 
    for (let [i, file] of files.entries()) {
      zip.file(REGIONS[i] + ".conf", file);
    }
 
    zip.generateAsync({ type: "blob" }).then(function (content) {
      const d = new Date();
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      saveAs(content, `SurfSharkConf4WG_${month + day}.zip`);
    });
  }
})();
