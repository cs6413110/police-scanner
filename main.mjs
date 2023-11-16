/*
  Radio Sources are from https://www.broadcastify.com/listen/official
  
  Audio to Text conversion by assemblyai(NOT 100% FREE)
*/

import fetch from 'node-fetch';
import {ChatGPTUnofficialProxyAPI} from 'chatgpt';
//import { nodewhisper } from 'nodejs-whisper'

//const chatgpt = new ChatGPTUnofficialProxyAPI({accessToken: ''});  

const policeRadioSources = {}, scanners = [], events = [];
policeRadioSources['Mesa Police Department Central Patrol District'] = 'https://listen.broadcastify.com/nqhkys674dzfmvx.mp3?nc=66398&xan=xtf9912b41c';
//policeRadioSources['Mesa Police Department Fiesta Patrol District'] = '';

class PoliceScanner {
  constructor(url) {
    this.data = [];
    this.url = url;
    this.request(url);
    setInterval(() => this.whispr(), 15000); // translate data to text via whispr every 15 seconds
  }

  async request(url) {
    this.res = await fetch(url);
    this.res.body.on('data', buffer => {
      console.log('Data received: '+buffer);
      this.data.push(buffer);
    });
  }

  async whispr() {
    
  }

  
}

for (const source of policeRadioSources) scanners.push(new PoliceScanner(source));


