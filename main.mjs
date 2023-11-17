/*
  Radio Sources are from https://www.broadcastify.com/listen/official
  Whisper audio to text conversion
  Chatgpt data to json interpretation


  Setup:
  clone this repo
  npm install node-fetch chatgpt whisper-node
  nano node_modules/whisper-node/lib/whisper.cpp/models/download-ggml-model.sh
  set the src value to "https://huggingface.co/ggerganov/whisper.cpp"
  run the file you just edited with paramater tiny.en: ./node_modules/whisper-node/lib/whisper.cpp/models/download-ggml-model.sh tiny.en
  run with node main.mjs
*/

import fs from 'fs';
import fetch from 'node-fetch';
import ffmpeg from 'fluent-ffmpeg';
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';
import {ChatGPTUnofficialProxyAPI} from 'chatgpt';
import {nodewhisper as whisper} from 'nodejs-whisper';

const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);

const chatgpt = new ChatGPTUnofficialProxyAPI({accessToken: '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'}); 
const prompt = 'You are a police radio scanner. Your job is to take the provided radio text and use the information to provided data to a safety application to notify home owners of nearby crime. You will provided a response with data structured like so: [{"address":"<Address of the event, defaults to UNKNOWN>","starttime":"<time of the occurance, defaults to RECENTLY">,"type":"<Type of the event(e.g robbery, break-in, assult, threat...), defaults to UNKNOWN>"}]. Here is the police radio stream in a text format for you to process: ';

let policeRadioSources = {}, scanners = [], events = [];
policeRadioSources['Mesa_Police_Department_Central_Patrol_District'] = 'https://listen.broadcastify.com/qvm5g8yst6cbj92.mp3?nc=72701&xan=xtf9912b41c';
//policeRadioSources['Mesa Police Department Fiesta Patrol District'] = '';

class PoliceScanner {
  constructor(url, name) {
    this.filesToProcess = [];
    this.transcript = '';
    this.url = url;
    this.name = name;
    this.request(url);
    setInterval(() => this.whispr(), 10000); // translate data to text via whispr every 60 seconds
    setInterval(() => this.chatgpt(), 60000); // convert format into readable
  }

  async request(url) {
    this.res = await fetch(url);
    this.makeFileStream();
  }

  makeFileStream() {
    this.fileSource = `${this.name}@${Math.random()}.mp3`; // Random file name for ref
    this.file = fs.createWriteStream(resolve(__dirname, this.fileSource)); // Create write stream
    this.file.on('error', e => console.error(e));
    this.res.body.pipe(this.file); // Link to mp3 stream
    setTimeout(() => this.file.end(), 1000*30); // File size will be ~10 minute longs
    this.file.on('finish', () => {
      this.filesToProcess.push(this.fileSource);
      this.makeFileStream();
    }); // After stream is 100% done, link a new stream
  }

  async whispr() {
    for (const filename of this.filesToProcess) {
      const transcript = await whisper(resolve(__dirname, filename), {modelName: 'tiny.en', whisperOptions: {outputInText: true}});
      this.filesToProcess.splice(this.filesToProcess.indexOf(filename), 1);
      this.transcript += transcript;
    }
  }  

  async chatgpt() {
    console.log('Applying chatgpt to: '+this.transcript);
    const res = await chatgpt.sendMessage('hi');
    console.log(JSON.stringify(res));
    console.log(res.text);    
  }
}

for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
