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
*/

import fs from 'fs';
import fetch from 'node-fetch';
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';
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
policeRadioSources['Mesa_Police_Department_Fiesta_Patrol_District'] = 'https://listen.broadcastify.com/x2k9g1dfq7ct85n.mp3?nc=12277&xan=xtf9912b41c';
policeRadioSources['Mesa_Police_Department_Red_Mountain_Patrol_District'] = 'https://listen.broadcastify.com/429ms5hp86ywbdz.mp3?nc=68310&xan=xtf9912b41c';
policeRadioSources['Mesa_Police_Department_Superstition_Patrol_District'] = 'https://listen.broadcastify.com/fc9m862sj345byx.mp3?nc=67966&xan=xtf9912b41c';

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
