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
function blob转AudioBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result;
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        resolve(audioBuffer);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
function 剪切AudioBuffer(buffer, startSec, endSec) {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;

  const startOffset = Math.floor(startSec * sampleRate);
  const endOffset = Math.floor(endSec * sampleRate);

  const cutLength = buffer.length - (endOffset - startOffset);
  const newBuffer = new AudioBuffer({
    length: cutLength,
    sampleRate,
    numberOfChannels: numChannels,
  });

  for (let channel = 0; channel < numChannels; channel++) {
    const oldData = buffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    newData.set(oldData.subarray(0, startOffset));
    newData.set(oldData.subarray(endOffset), startOffset);
  }

  return newBuffer;
}
function audioBuffer转Blob(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const samples = audioBuffer.length;
  const blockAlign = (bitDepth / 8) * numChannels;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  function writeString(s) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset++, s.charCodeAt(i));
    }
  }

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4; // PCM header size
  view.setUint16(offset, format, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bitDepth, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = audioBuffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}
function 去除静音(
  audioBuffer,
  阈值百分比 = 25,
  最小持续时间秒 = 0.5,
  缓冲区域秒 = 0.1
) {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // 用第一个声道分析

  // 先找最大音量，用来算百分比阈值
  let maxAmp = 0;
  for (let i = 0; i < channelData.length; i++) {
    const amp = Math.abs(channelData[i]);
    if (amp > maxAmp) maxAmp = amp;
  }

  const 阈值 = maxAmp * (阈值百分比 / 100);
  const minSilentSamples = 最小持续时间秒 * sampleRate;
  const bufferSamples = 缓冲区域秒 * sampleRate;

  let segments = [];
  let isSilent = false;
  let silenceStart = 0;
  let lastIndex = 0;

  for (let i = 0; i < channelData.length; i++) {
    if (Math.abs(channelData[i]) < 阈值) {
      if (!isSilent) {
        isSilent = true;
        silenceStart = i;
      }
    } else {
      if (isSilent) {
        const silentLength = i - silenceStart;
        if (silentLength >= minSilentSamples) {
          // 移除片段加入缓冲区域
          // 调整去静音片段范围：头尾各加缓冲，但是不要越界
          const cutStart = Math.max(silenceStart + bufferSamples, lastIndex);
          const cutEnd = Math.min(i - bufferSamples, channelData.length);

          if (lastIndex < cutStart) {
            segments.push([lastIndex, cutStart]); // 非静音片段，留着
          }
          lastIndex = cutEnd;
        }
        isSilent = false;
      }
    }
  }

  // 处理结尾
  if (isSilent) {
    const silentLength = channelData.length - silenceStart;
    if (silentLength >= minSilentSamples) {
      const cutStart = Math.max(silenceStart + bufferSamples, lastIndex);
      const cutEnd = channelData.length;
      if (lastIndex < cutStart) segments.push([lastIndex, cutStart]);
      lastIndex = cutEnd;
    }
  }

  // 把最后的非静音尾部加上
  if (lastIndex < channelData.length) {
    segments.push([lastIndex, channelData.length]);
  }

  // 合并所有非静音片段
  const totalLength = segments.reduce((acc, [s, e]) => acc + (e - s), 0);
  const newBuffer = new AudioBuffer({
    length: totalLength,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
  });

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const oldData = audioBuffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    let offset = 0;
    for (const [start, end] of segments) {
      newData.set(oldData.subarray(start, end), offset);
      offset += end - start;
    }
  }

  return newBuffer;
}

let 当前录音进程 = null;
var 当前音频Buf = null;
var 当前音频Blob = null;
const ffmpegPath = path.join(
  __dirname,
  "tools",
  "ffmpeg-2025-06-16-git-e6fb8f373e-essentials_build",
  "bin",
  "ffmpeg.exe"
);
const 音频历史栈 = [];

function 保存当前状态() {
  if (当前音频Blob && 当前音频Buf) {
    音频历史栈.push({
      blob: 当前音频Blob,
      buf: 当前音频Buf,
    });
  }
}

function 撤销操作() {
  if (音频历史栈.length === 0) {
    alert("没有可撤销的操作");
    return;
  }
  const 上一次状态 = 音频历史栈.pop();
  当前音频Blob = 上一次状态.blob;
  当前音频Buf = 上一次状态.buf;

  渲染示波器();
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
    alert(`发生了错误: ${err}`);
  }
};
document.getElementById("startBtn").onclick = async () => {
  try {
    const 音频输入设备 = document.getElementById("audioDeviceSelect").value;
    if (!音频输入设备) return alert("无效的音频输入设备");

    if (当前录音进程) {
      alert("录音已在进行中!");
      return;
    }

    当前录音数据缓存 = [];
    const ffmpegArgs = [
      "-f",
      "dshow",
      "-i",
      `audio=${音频输入设备}`,
      "-acodec",
      "pcm_s16le",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-f",
      "wav",
      "pipe:1",
    ];

    // alert("点击确认后开始录音");

    当前录音进程 = spawn(ffmpegPath, ffmpegArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    document.getElementById("recordingIndicator").style.visibility = "visible";

    当前录音进程.stdout.on("data", (chunk) => {
      当前录音数据缓存.push(chunk);
    });

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

    var code = await new Promise((res) => {
      当前录音进程.on("close", res);
    });

    当前录音进程 = null;
    document.getElementById("recordingIndicator").style.visibility = "hidden";
    console.log("录音结束, ffmpeg退出码:", code);

    当前音频Buf = Buffer.concat(当前录音数据缓存);
    当前音频Blob = new Blob([当前音频Buf], { type: "audio/wav" });

    渲染示波器();
  } catch (err) {
    alert("发生了错误: " + err.message);
  }
};
document.getElementById("toLibBut").onclick = async () => {
  if (!当前音频Blob) {
    alert("没有可导入的录音");
    return;
  }

  let 临时文件路径 = "";
  try {
    const 当前fla路径 = await 获得当前fla文件路径();
    临时文件路径 = path
      .join(
        path.dirname(当前fla路径),
        Date.now().toString() + "_" + 生成随机名称() + ".wav"
      )
      .replace(/\\/g, "/");

    await fs.promises.writeFile(临时文件路径, 当前音频Buf);
    await 导入文件到库("file:///" + 临时文件路径);
    console.log("导入成功!");
  } catch (err) {
    alert("发生了错误: " + err.message);
  } finally {
    try {
      await fs.promises.unlink(临时文件路径);
      console.log("临时文件删除成功!");
    } catch {}
  }
};
document.getElementById("autoCutBtn").onclick = async () => {
  if (!当前音频Blob) {
    alert("没有可剪辑的音频！");
    return;
  }

  保存当前状态();

  const audioBuffer = await blob转AudioBuffer(当前音频Blob);
  const 去静音后 = 去除静音(audioBuffer);
  当前音频Blob = audioBuffer转Blob(去静音后);
  当前音频Buf = Buffer.from(await 当前音频Blob.arrayBuffer());
  渲染示波器();
};
document.getElementById("undoBtn").onclick = () => {
  撤销操作();
};

let wavesurfer;
let regions;
function 渲染示波器() {
  let 当前的区域 = null;
  let 结束播放位置 = null;

  if (wavesurfer) wavesurfer.destroy();
  if (regions) regions.destroy();

  regions = WaveSurfer.Regions.create();
  wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "#007bff",
    progressColor: "#0056b3",
    height: 128,
    responsive: true,
    plugins: [regions],
  });
  regions.enableDragSelection({
    color: "rgba(255, 0, 0, 0.1)",
  });
  regions.on("region-created", (a) => {
    if (当前的区域) 当前的区域.remove();
    当前的区域 = a;
  });
  wavesurfer.on("timeupdate", (a) => {
    if (结束播放位置 !== null && a >= 结束播放位置) wavesurfer.pause();
  });

  document.getElementById("playRegions").onclick = async () => {
    if (!当前的区域) return;
    结束播放位置 = 当前的区域.end;
    当前的区域.play();
  };
  document.getElementById("delRegions").onclick = async () => {
    if (!当前的区域) return;

    保存当前状态();

    var audioBuffer = await blob转AudioBuffer(当前音频Blob);
    var 剪切后的audioBuffer = 剪切AudioBuffer(
      audioBuffer,
      当前的区域.start,
      当前的区域.end
    );
    当前音频Blob = audioBuffer转Blob(剪切后的audioBuffer);
    当前音频Buf = Buffer.from(await 当前音频Blob.arrayBuffer());

    当前的区域.remove();

    渲染示波器();
  };

  wavesurfer.load(URL.createObjectURL(当前音频Blob));
  window.onkeydown = function (event) {
    event.preventDefault();

    // 避免在输入框中按空格也触发播放
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

    // 处理空格事件
    if (event.code === "Space") {
      // 阻止页面滚动
      结束播放位置 = null;
      wavesurfer.playPause();
    }
  };
}
