/*
  Radio Sources are from https://www.broadcastify.com/listen/official
  Whisper audio to text conversion
  Chatgpt data to json interpretation

  Advantages: 100% free
  Disadvantages: May implode server cpu because it uses whisper(audio to text ai) locally.


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
import {dirname, resolve} from 'path';
import ffmpeg from 'fluent-ffmpeg';
import {gpt} from 'gpti';
import {nodewhisper as whisper} from 'nodejs-whisper';

const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);
const prompt = `
Please use the provided radio text to generate a JSON response containing police event data. The response should be a valid JSON array consisting of objects, where each object represents an event. Each event should have the following properties:

1. "address": This property should contain the address of the event in USPS standard address format. If the address is unknown, please use the value "UNKNOWN".

2. "type": This property represents the type of the event and should be labeled as one of the recognized criminal offenses by the FBI. If the type is unclear, please use the value "UNKNOWN".

Here is an example output to follow:
[{"address":"4928 E Warding Cir","type":"Intimidation"}]

If there is no clear event or if both address and type are unknown, simply return an empty array. Please keep in mind that the translator for police radio to text may introduce errors and misinterpretations, so use the most likely options if a word doesn't fit the context. 

Please process the following data and generate the appropriate JSON response:
`;
let policeRadioSources = {}, scanners = [], events = [];
policeRadioSources['Mesa_Police_Department_Central_Patrol_District'] = 'https://listen.broadcastify.com/qvm5g8yst6cbj92.mp3?nc=72701&xan=xtf9912b41c';
//policeRadioSources['Mesa_Police_Department_Fiesta_Patrol_District'] = 'https://listen.broadcastify.com/x2k9g1dfq7ct85n.mp3?nc=12277&xan=xtf9912b41c';
//policeRadioSources['Mesa_Police_Department_Red_Mountain_Patrol_District'] = 'https://listen.broadcastify.com/429ms5hp86ywbdz.mp3?nc=68310&xan=xtf9912b41c';
//policeRadioSources['Mesa_Police_Department_Superstition_Patrol_District'] = 'https://listen.broadcastify.com/fc9m862sj345byx.mp3?nc=67966&xan=xtf9912b41c';

class PoliceScanner {
  constructor(url, name) {
    this.filesToProcess = [];
    this.transcript = [];
    this.url = url;
    this.name = name;
    this.busy = false;
    this.request(url);
    setInterval(() => {
      this.whispr();
      this.chatgpt();
    }, 60000); // translate with ai every 60 seconds
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
      ffmpeg(resolve(__dirname, this.fileSource)).toFormat('wav').outputOptions('-ar 16000').on('end', () => {
        this.filesToProcess.push(this.fileSource);
        this.makeFileStream();
      }).save(resolve(__dirname, this.fileSource).replace('mp3', 'wav'));
    }); // After stream is 100% done, link a new stream
  }

  async whispr() {
    if (this.busy) return;
    for (const filename of this.filesToProcess) {
      this.filesToProcess.splice(this.filesToProcess.indexOf(filename), 1);
      this.busy = true;
      const transcript = await whisper(resolve(__dirname, filename).replace('mp3', 'wav'), {modelName: 'tiny.en'});
      this.busy = false;
      console.log('transcript: '+JSON.stringify(transcript));
      this.transcript.push(transcript.speech);
      fs.unlinkSync(resolve(__dirname, filename));
      fs.unlinkSync(resolve(__dirname, filename).replace('mp3', 'wav'));
    }
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
      console.log('Premature: '+JSON.stringify(this.premature));
      console.log('Transcript: '+JSON.stringify(this.transcript));
      if (this.transcript.length >= 6) {
        events = events.concat(this.premature);
        this.transcript = this.transcript.slice(-3);
      }
    });
  }
}

setInterval(() => console.log('Probable: '+JSON.stringify(events)), 30000); // event log every 30 seconds 

for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
