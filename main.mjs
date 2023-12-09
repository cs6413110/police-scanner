/*
  Radio Sources are from https://www.broadcastify.com/listen/official
  Chatgpt usage via npm package gpti

  Setup:
  - run `npm install fs node-fetch url path @deepgram/sdk fluent-ffmpeg gpti`

  Startup:
  - run `node main.mjs`

  Warnings:
  The radio sources
*/

import fs from 'fs';
import fetch from 'node-fetch';
import {fileURLToPath} from 'url';
import dg from '@deepgram/sdk/dist/index.js';
import {dirname, resolve} from 'path';
import ffmpeg from 'fluent-ffmpeg';
import {gpt} from 'gpti';
const {Deepgram} = dg;
const deepgram = new Deepgram('8f4de099ff5cefb96a48084143d9b48afd87e0b3');
const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);
const prompt = `Your job is to interpret data from an AI audio transcription. The transcription is of police radio. Your job is to determine what criminal events are happening by obtaining both the address location of an event and the criminal offense type of the event. You will respond in json format like so: [{"type":"type of event","address":"address where event is occuring","confidence":"your confidence that this event is happening based on the transcript in percent"},{"type":"Intimidation","address":"4423 E. Example Rd.","confidence":"12"}]. The events must be exact. It is crucial that your response is correct. Double or even triple check that the event is happening. A misinterpreted or nonexistant event could lead to huge infrastructure damage. Here is the raw transcript data: `;
const prompt2 = `You are a professional radio police analyzer trained to interpret police radio and provide public safety information of ongoing crime. You are training a new trainee and need to double check his results. Respond with the correction to what he got in JSON format. The format is like so: [{"type":"type of event","address":"address where event is occuring","confidence":"your confidence that this event is happening based on the transcript in percent"},{"type":"Intimidation","address":"4423 E. Example Rd.","confidence":"12"}]. Your response must be correct. Double and triple check that each crime event is happening based on the transcript. A misinterpreted or nonexistant event reported could lead to huge infrastructure damage. Here is the text transcript along with the trainees attempt: `
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

  checkIfValid(p) {
    if (!Array.isArray(p)) return false;
    for (const e of this.premature) if (Object.keys(e).length !== 3 || !e.type || !e.address || !e.confidence) return false;
  }

  filterUnclear(p) {
    const badValues = ['unknown', '', '0'];
    return p.filter(e => {
      for (const value of Object.values(e)) if (badValues.includes(String(value).toLowerCase())) return false;
      return true;
    })
  }

  chatgpt() {
    if (!this.transcript.length) return;
    gpt({prompt: prompt+this.transcript.join('\n'), model: 'gpt-4', type: 'json'}, (err, data) => {
      const res = JSON.parse(data.gpt);
      if (!this.checkIfValid(res)) return this.chatgpt();
      const premature = this.filterUnclear(res);
      console.log('Transcript:');
      for (const transcript of this.transcript) console.log(`\n${JSON.parse(transcript).transcript}`);
      console.log('Premature: '+JSON.stringify(premature));
      this.checkGpt(premature, this.transcript);
    });
  }

  checkGpt(premature, transcript) {
    gpt({prompt: prompt2+transcript.join('\n')+' Trainee Response: '+JSON.stringify(premature), model: 'gpt-4', type: 'json', (err, data) => {
      const res = JSON.parse(data.gpt);
      if (!this.checkIfValid(res)) return this.checkGpt(premature, transcript);
      this.premature = this.filterUnclear(res);
      console.log('Old: '+premature);
      console.log('Refactored: '+this.premature);
      if (this.transcript.length >= 30) {
        events = events.concat(this.premature);
        this.transcript = this.transcript.slice(-15);
      }
    });
  }
}

setInterval(() => console.log('Probable: '+JSON.stringify(events)), 60000); // event log every 30 seconds 
for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
