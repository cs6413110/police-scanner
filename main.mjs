/*
  Radio Sources are from https://www.broadcastify.com/listen/official
  Whisper audio to text conversion
  Chatgpt data to json interpretation
*/

import fs from 'fs';
import fetch from 'node-fetch';
import {ChatGPTUnofficialProxyAPI} from 'chatgpt';
import whisper from 'whisper-node';

const chatgpt = new ChatGPTUnofficialProxyAPI({accessToken: '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'}); 
const prompt = 'You are a police radio scanner. Your job is to take the provided radio text and use the information to provided data to a safety application to notify home owners of nearby crime. You will provided a response with data structured like so: [{"address":"<Address of the event, defaults to UNKNOWN>","starttime":"<time of the occurance, defaults to RECENTLY">,"type":"<Type of the event(e.g robbery, break-in, assult, threat...), defaults to UNKNOWN>"}]. Here is the police radio stream in a text format for you to process: ';

let policeRadioSources = {}, scanners = [], textToProcess = [], events = [];
policeRadioSources['Mesa Police Department Central Patrol District'] = 'https://listen.broadcastify.com/nqhkys674dzfmvx.mp3?nc=66398&xan=xtf9912b41c';
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
    this.file = fs.createWriteStream(this.fileSource); // Create write stream
    this.res.body.pipe(this.file); // Link to mp3 stream
    setTimeout(() => this.file.end(), 1000*30); // File size will be ~10 minute longs
    this.file.on('finish', () => {
      this.filesToProcess.push(this.fileSource);
      this.makeFileStream()
    }); // After stream is 100% done, link a new stream
  }

  async whispr() {
    for (const filename of this.filesToProcess) {
      const transcript = await whisper(`./${filename}`);
      textToProcess.push(transcript.speech);
    }
  }  
}

setInterval(async() => { // Loop for processing text via chatgpt into events
  for (const text of textToProcess) {
    const res = await chatgpt.sendMessage(prompt+text);
    events = events.concat(JSON.parse(res.text));
  }
  textToProcess = [];
  console.log(events);
}, 60*1000);

for (const source of Object.keys(policeRadioSources)) scanners.push(new PoliceScanner(policeRadioSources[source], source)); // Launch the radio listeners
