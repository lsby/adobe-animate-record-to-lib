const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

async function 获得当前fla文件路径() {
  var 当前fla文件路径 = new Promise((res, rej) => {
    window.__adobe_cep__.evalScript(
      `
        (function(){
          var doc = fl.getDocumentDOM();
          if(!doc) return "没有打开文档";
          var path = doc.path;
          return path ? path : "文档未保存";
        })();
      `,
      function (result) {
        if (result === "没有打开文档" || result === "文档未保存") {
          rej(result);
          return;
        }
        res(result);
      }
    );
  });
  return 当前fla文件路径;
}
async function 导入文件到库(文件路径) {
  return await new Promise((res, rej) => {
    window.__adobe_cep__.evalScript(
      `(function(){
          var doc = fl.getDocumentDOM();
          if(!doc) return "没有打开文档";
          try {
            doc.importFile("${文件路径}");
            return "导入成功";
          } catch(e) {
            return "导入失败: " + e.message;
          }
        })();`,
      function (result) {
        if (result.includes("导入失败")) {
          rej(result);
          return;
        }
        res();
      }
    );
  });
}
async function 获得音频设备列表() {
  return new Promise((resolve, reject) => {
    const ffmpegPath = path.join(
      __dirname,
      "tools",
      "ffmpeg-2025-06-16-git-e6fb8f373e-essentials_build",
      "bin",
      "ffmpeg.exe"
    );

    const ffmpeg = spawn(ffmpegPath, [
      "-f",
      "dshow",
      "-list_devices",
      "true",
      "-loglevel",
      "info",
      "-hide_banner",
      "-i",
      "dummy",
    ]);

    let output = "";

    ffmpeg.stderr.on("data", (data) => {
      output += data.toString();
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });

    ffmpeg.on("close", () => {
      const deviceRegex = /"(.+?)"\s+\(audio\)/g;
      const devices = [];
      let match;
      while ((match = deviceRegex.exec(output)) !== null) {
        devices.push(match[1]);
      }

      resolve(devices);
    });
  });
}
function 生成随机名称(长度 = 8) {
  const 字符集 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let 结果 = "";
  for (let i = 0; i < 长度; i++) {
    结果 += 字符集.charAt(Math.floor(Math.random() * 字符集.length));
  }
  return 结果;
}

document.getElementById("getAudioList").onclick = async () => {
  try {
    const devices = await 获得音频设备列表();
    const select = document.getElementById("audioDeviceSelect");
    select.innerHTML = '<option value="">请选择</option>';
    devices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device;
      option.textContent = device;
      select.appendChild(option);
    });
  } catch (err) {
    alert(`读取输入设备列表失败: ${err}`);
  }
};

let 当前录音进程 = null;
var 当前临时音频文件路径 = null;
const ffmpegPath = path.join(
  __dirname,
  "tools",
  "ffmpeg-2025-06-16-git-e6fb8f373e-essentials_build",
  "bin",
  "ffmpeg.exe"
);

document.getElementById("startBtn").onclick = async () => {
  try {
    当前临时音频文件路径 = path.join(
      path.dirname(await 获得当前fla文件路径()),
      Date.now().toString() + "_" + 生成随机名称() + ".wav"
    );

    const 音频输入文件名称 = document.getElementById("audioDeviceSelect").value;
    if (!音频输入文件名称) return alert("无效的音频设备");

    if (当前录音进程) {
      alert("录音已在进行中!");
      return;
    }

    const ffmpegArgs = [
      "-f",
      "dshow",
      "-i",
      `audio=${音频输入文件名称}`,
      "-acodec",
      "pcm_s16le",
      "-ar",
      "44100",
      "-ac",
      "2",
      当前临时音频文件路径,
    ];

    // alert("点击确认后开始录音");

    当前录音进程 = spawn(ffmpegPath, ffmpegArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    document.getElementById("recordingIndicator").style.visibility = "visible";

    当前录音进程.stderr.on("data", (data) => {
      console.log(`ffmpeg: ${data.toString()}`);
    });

    当前录音进程.on("error", (err) => {
      alert("录音启动失败: " + err.message);
      当前录音进程 = null;
      document.getElementById("recordingIndicator").style.visibility = "hidden";
    });
  } catch (err) {
    alert(`发生了错误: ${err}`);
  }
};

document.getElementById("stopBtn").onclick = async () => {
  if (!当前录音进程) {
    alert("没有正在进行的录音");
    return;
  }

  try {
    当前录音进程.stdin.write("q");
    当前录音进程.stdin.end();

    var code = await new Promise((res, rej) => {
      当前录音进程.on("close", async (code) => {
        res(code);
      });
    });

    当前录音进程 = null;
    document.getElementById("recordingIndicator").style.visibility = "hidden";
    console.log("录音结束, ffmpeg退出码:", code);

    await 导入文件到库("file:///" + 当前临时音频文件路径.replace(/\\/g, "/"));
    console.log("导入成功!");

    await fs.promises.unlink(当前临时音频文件路径);
    当前临时音频文件路径 = null;
    console.log("临时文件删除成功!");
  } catch (err) {
    alert("发生了错误: " + err.message);
  }
};
