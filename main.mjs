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
import {whisper} from 'whisper-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const chatgpt = new ChatGPTUnofficialProxyAPI({accessToken: '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'}); 
const prompt = 'You are a police radio scanner. Your job is to take the provided radio text and use the information to provided data to a safety application to notify home owners of nearby crime. You will provided a response with data structured like so: [{"address":"<Address of the event, defaults to UNKNOWN>","starttime":"<time of the occurance, defaults to RECENTLY">,"type":"<Type of the event(e.g robbery, break-in, assult, threat...), defaults to UNKNOWN>"}]. Here is the police radio stream in a text format for you to process: ';

let policeRadioSources = {}, scanners = [], textToProcess = [], events = [];
policeRadioSources['Mesa_Police_Department_Central_Patrol_District'] = 'https://listen.broadcastify.com/nqhkys674dzfmvx.mp3?nc=66398&xan=xtf9912b41c';
//policeRadioSources['Mesa Police Department Fiesta Patrol District'] = '';

class PoliceScanner {
  constructor(url, name) {
    this.filesToProcess = [];
    this.url = url;
    this.name = name;
    this.request(url);
    setInterval(() => this.whispr(), 10000); // translate data to text via whispr every 60 seconds
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
      ffmpeg(resolve(__dirname, this.fileSource)).toFormat('wav').audioBitrate('16k').on('error', err => console.log('An error occurred: ' + err.message)).on('progress', (progress) => {
        console.log('Processing: ' + progress.targetSize + ' KB converted');
      }).on('end', () => {
        console.log('Processing finished !');
      }).save(resolve(__dirname, this.fileSource).replace('.mp3', '.wav'));
      this.filesToProcess.push(this.fileSource);
      this.makeFileStream()
    }); // After stream is 100% done, link a new stream
  }

  async whispr() {
    for (const filename of this.filesToProcess) {
      const transcript = await whisper(resolve(__dirname, filename).replace('.mp3', '.wav'), {modelName: 'tiny.en'});
      console.log(transcript);
      console.log(transcript.speech);
      textToProcess.push(transcript.speech);
    }
  }  
}

setInterval(async() => { // Loop for processing text via chatgpt into events
  console.log('gpt');
  for (const text of textToProcess) {
    const res = await chatgpt.sendMessage(prompt+text);
    events = events.concat(JSON.parse(res.text));
  }
  textToProcess = [];
  console.log(events);
}, 60*1000);

for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
