/*
  Resouces:
  
  Radio Sources are from https://www.broadcastify.com/listen/official
  Chatgpt usage is free with gpti

  Process:

  Download mp3 files from radio sources
  Send files to deepgram(ai company that converts text to speech)

  Setup:
  clone this repo
  Command: npm install node-fetch gpti nodejs-whisper
  Command: npx nodejs-whisper download 
  Install tiny.en model
  Run this file

  Possible Optimizations:
    - Find a way to not create/delete audio files?
    - Use whisper as a service instead of locally
  Possible Upgrades:
    - Connect to mongodb server and scale
*/

import fs from 'fs';
import fetch from 'node-fetch';
import {fileURLToPath} from 'url';
import dg from '@deepgram/sdk/dist/index.js';
import {dirname, resolve} from 'path';
import ffmpeg from 'fluent-ffmpeg';
import {gpt} from 'gpti';
import {nodewhisper as whisper} from 'nodejs-whisper';
const {Deepgram} = dg;
const deepgram = new Deepgram('8f4de099ff5cefb96a48084143d9b48afd87e0b3');
const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);
const prompt = `Your job is to interpret data from an AI audio transcription. The transcription is of police radio. Your job is to determine what criminal events are happening by obtaining both the address location of an event and the criminal offense type of the event. You will respond in json format like so: [{"type":"type of event","address":"address where event is occuring"},{"type":"Intimidation","address":"4423 E. Example Rd."}]. Here is the raw transcript data: `;
let policeRadioSources = {}, scanners = [], events = [];
policeRadioSources['Mesa_Police_Department_Central_Patrol_District'] = 'https://listen.broadcastify.com/935hgs14f6r7cj0.mp3?nc=63732&xan=xtf9912b41c';
  
class PoliceScanner {
  constructor(url, name) {
    this.transcript = [];
    this.url = url;
    this.name = name;
    this.request(url);
  }

  async request(url) {
    this.res = await fetch(url);
    this.makeFileStream();
  }

  makeFileStream() {
    this.fileSource = `${this.name}.mp3`; // Random file name for ref
    this.file = fs.createWriteStream(resolve(__dirname, this.fileSource)); // Create write stream
    this.file.on('error', e => console.error(e));
    this.res.body.pipe(this.file); // Link to mp3 stream
    setTimeout(() => this.file.end(), 60000); // File size will be ~10 minute longs
    this.file.on('finish', () => {
      ffmpeg(resolve(__dirname, this.fileSource)).toFormat('wav').outputOptions('-ar 16000').on('end', () => {
        this.transcribe();
        this.chatgpt();
      }).save(resolve(__dirname, this.fileSource).replace('mp3', 'wav'));
    });
  }

  async transcribe() {
    deepgram.transcription.preRecorded({stream: fs.createReadStream(resolve(__dirname, this.fileSource).replace('mp3', 'wav')), mimetype: 'audio/wav'}).then(data => {
      this.transcript.push(JSON.stringify(data.results.channels[0].alternatives[0]));
      fs.unlinkSync(resolve(__dirname, this.fileSource));
      fs.unlinkSync(resolve(__dirname, this.fileSource).replace('mp3', 'wav'));
      this.makeFileStream();
    });
  }  

  async chatgpt() {
    if (this.transcript.length === 0) return;
    gpt({prompt: prompt+this.transcript.join('\n'), model: 'gpt-4', type: 'json'}, (err, data) => {
      this.premature = JSON.parse(data.gpt);
      if (!Array.isArray(this.premature)) return this.chatgpt(); // recompute
      this.premature = this.premature.filter(e => {
        if (Object.keys(e).length !== 2 || e.type === undefined || e.address === undefined) return this.chatgpt();
        if (e.type.toLowerCase() === 'unknown' && e.address.toLowerCase() === 'unknown') return false;
        return true;
      });
      console.log('Transcript: '+this.transcript.join('\n'));
      console.log('Premature: '+JSON.stringify(this.premature));
      if (this.transcript.length >= 30) {
        events = events.concat(this.premature);
        this.transcript = this.transcript.slice(-15);
      }
    });
  }
}

setInterval(() => console.log('Probable: '+JSON.stringify(events)), 30000); // event log every 30 seconds 
for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
