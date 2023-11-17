/*
  Radio Sources are from https://www.broadcastify.com/listen/official
  Whisper audio to text conversion
  Chatgpt data to json interpretation


  Setup:
  clone this repo
  Command: npm install node-fetch gpti nodejs-whisper
  Command: npx nodejs-whisper download 
  Install tiny.en model
  Run this file

  Possible Optimizations:
    - Find a way to not create/delete audio files?
*/

import fs from 'fs';
import fetch from 'node-fetch';
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';
import {gpt} from 'gpti';
import {nodewhisper as whisper} from 'nodejs-whisper';

const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);
const prompt = 'You are a police radio scanner. Your job is to take the provided radio text and use the information to provided data to a safety application to notify home owners of nearby crime. You will provided a response with data structured like so: [{"address":"<Address of the event, defaults to UNKNOWN>","starttime":"<time of the occurance, defaults to RECENTLY">,"type":"<Type of the event(e.g robbery, break-in, assult, threat...), defaults to UNKNOWN>"}]. Here is the police radio stream in a text format for you to process: ';

let policeRadioSources = {}, scanners = [], events = [];
policeRadioSources['Mesa_Police_Department_Central_Patrol_District'] = 'https://listen.broadcastify.com/qvm5g8yst6cbj92.mp3?nc=72701&xan=xtf9912b41c';
//policeRadioSources['Mesa Police Department Fiesta Patrol District'] = '';

class PoliceScanner {
  constructor(url, name) {
    this.filesToProcess = [];
    this.transcript = [];
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
      const transcript = await whisper(resolve(__dirname, filename), {modelName: 'tiny.en'});
      fs.unlink(resolve(__dirname, filename), () => fs.unlink(resolve(__dirname, filename).replace('mp3', 'wav'), () => {
        this.filesToProcess.splice(this.filesToProcess.indexOf(filename), 1);
        this.transcript.push(transcript);
      }));
    }
  }  

  async chatgpt() {
    gpt({prompt: prompt+this.transcript, model: 'gpt-4', type: 'json'}, (err, data) => {
      this.premature = JSON.parse(data.gpt);
      console.log('Premature: '+this.premature);
      if (this.transcript.length >= 5) {
        events = events.concat(this.premature);
        this.transcript = [];
      }
    });
  }
}

setInterval(() => console.log('Probable: '+events), 30000); // event log every 30 seconds 

for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
