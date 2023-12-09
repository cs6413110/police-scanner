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
const prompt = `Your job is to interpret data from an AI audio transcription. The transcription is of police radio. Your job is to determine what criminal events are happening by obtaining both the address location of an event and the criminal offense type of the event. You will respond in json format like so: [{"type":"type of event","address":"address where event is occuring","confidence":"your confidence that this event is happening based on the transcript in percent"},{"type":"Intimidation","address":"4423 E. Example Rd.","confidence":"12"}]. The events must be exact. If there is not enough information to be certain that it is occuring just send an empty array. There also may be multiple events. Here is the raw transcript data: `;
let policeRadioSources = {}, scanners = [], events = [];
policeRadioSources['Mesa_Police_Department_Central_Patrol_District'] = 'https://listen.broadcastify.com/qhb3rw91dy7n86c.mp3?nc=94574&xan=xtf9912b41c';
  
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
        const badValues = ['unknown', '']; // add more bad values here to filter chatgpt results
        if (Object.keys(e).length !== 2 || e.type === undefined || e.address === undefined) return this.chatgpt();
        if (badValues.includes(e.type.toLowerCase()) && badValues.includes(e.address.toLowerCase())) return false;
        return true;
      });
      let rawWords = '';
      for (const transcript of this.transcript) {
        rawWords += `
        ${JSON.parse(transcript).transcript}`;
      }
      console.log('Transcript: '+rawWords);
      console.log('Premature: '+JSON.stringify(this.premature));
      if (this.transcript.length >= 30) {
        events = events.concat(this.premature);
        this.transcript = this.transcript.slice(-15);
      }
    });
  }
}

setInterval(() => console.log('Probable: '+JSON.stringify(events)), 60000); // event log every 30 seconds 
for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
