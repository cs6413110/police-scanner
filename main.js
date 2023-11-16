/*
  Radio Sources are from https://www.broadcastify.com/listen/official
  
  Audio to Text conversion by assemblyai(NOT 100% FREE)
*/

const {AssemblyAI} = require('assemblyai');
const fetch = require('node-fetch');
const client = new AssemblyAI({apiKey: '19b97f1b12024a1fae253a33724f32c7'});
const realtime = client.realtime.createService({sampleRate: 16_000});
const policeRadioSources = {}
policeRadioSources['Mesa Police Department Central Patrol District'] = 'https://listen.broadcastify.com/nqhkys674dzfmvx.mp3?nc=66398&xan=xtf9912b41c';

(async() => {
  realtime.on('open', ({sessionId}) => console.log('Session created with id: '+sessionId));
  realtime.on('error', error => console.error(error));
  realtime.on('close', (code, reason) => console.log('Session closed:', code, reason));
  realtime.on('transcript', transcript => {
    console.log('Received:', transcript)
    if (!transcript.text) return;
    if (transcript.message_type === 'FinalTranscript') {
      console.log('Final:', transcript.text);
    } else {
      console.log('Partial:', transcript.text);
    }
  });

  console.log('Connecting to real-time transcript service');
  await realtime.connect();
  const res = await fetch(policeRadioSources['Mesa Police Department Central Patrol District']);
  res.body.on('data', buffer => {
    console.log('fetch received data');
    realtime.sendAudio(buffer);
  });
})();

class RadioListener {

  
}
