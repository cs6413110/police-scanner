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
const prompt = `You are a police radio scanner. Your job is to take the provided radio text and use it to determine what criminal/police events are happening. Your response must be valid json that can be parsed with JSON.parse(). Your JSON should be an array of objects, each object representing an event. Each event should have information in the following categories: address(address of the event and type(what is the event). The address category should contain the address that the event is at. It should be in USPS standard address format. If the address is not known, put UNKNOWN as the default. The type category represents the type of the event. It should be labeled as one of the criminal offenses as recognized by the FBI or UNKNOWN if the context is unclear. Here is an example output: [{"address":"4928 E Warding Cir","type":"Intimidation"}]. If there is no clear event or if both address and type are unknown just send an empty array. In a case with multiple events send all of the events(add more objects to the array). The translator for police radio to text may be buggy so misinterpretation of words is possible. If a word does not fit within the context, use the most likely option instead. Here is the data for you to process: `;

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
      this.filesToProcess.splice(this.filesToProcess.indexOf(filename), 1);
      const transcript = await whisper(resolve(__dirname, filename), {modelName: 'tiny.en'});
      fs.unlink(resolve(__dirname, filename), () => fs.unlink(resolve(__dirname, filename).replace('mp3', 'wav'), () => this.transcript.push(transcript)));
    }
  }  

  async chatgpt() {
    gpt({prompt: prompt+this.transcript, model: 'gpt-4', type: 'json'}, (err, data) => {
      this.premature = JSON.parse(data.gpt);
      console.log('Premature: '+JSON.stringify(this.premature));
      if (this.transcript.length >= 5) {
        events = events.concat(this.premature);
        this.transcript = this.transcript.slice(Math.max(this.transcript.length-5, 0))
      }
    });
  }
}

setInterval(() => console.log('Probable: '+JSON.stringify(events)), 30000); // event log every 30 seconds 

for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
