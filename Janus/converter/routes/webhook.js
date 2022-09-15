const express = require("express");
const router = express.Router();
const _ = require("lodash");
const { join } = require("path");
require("dotenv").config({ path: join(__dirname, "../../.env") });
const { convertMjrFilesToAudioFile } = require("../converter");
const axios = require("axios");
const FormData = require("form-data");
const recordingDirectory = "../../recordings";
const baseDirPath = join(__dirname, recordingDirectory);
const recordingUploadEndpoint = process.env.RECORDING_UPLOAD_ENDPOINT;
const recordingUploadToken = process.env.URI_CONV_AUTH_TOKEN;
const fs = require("fs");
const uploadFileToServer = async (url, token, { fileBuffer, callId }) => {
  const form = new FormData();
  // Second argument  can take Buffer or Stream (lazily read during the request) too.
  // Third argument is filename if you want to simulate a file upload. Otherwise omit.
  form.append("callId", callId);
  form.append("file", fileBuffer,`${callId}.wav`);
  const headers={
    ...form.getHeaders(),
    authorization: `Bearer ${token}`,
  };
  console.log(headers)
  return axios.default.post(url, form, {
    headers
  });
};
/* GET home page. */
// object to store and manage all successful calls for recordings
let sessions = {};
// a timer to process each recording and remove them from session after uploading
setInterval(() => {
  // console.log(sessions)
  _.each(sessions, async (item) => {
    // console.log(item)
    const { sessionId, handleId, callId, recordingEnd } = item;
    if (recordingEnd) {
      console.log("recording ended");
      // TODO: process recordings and upload (joining two mjr audio file converting to wav and upload)
      await convertMjrFilesToAudioFile(
        baseDirPath,
        join(baseDirPath, `${callId}-peer-audio.mjr`),
        join(baseDirPath, `${callId}-user-audio.mjr`)
      );
      console.warn('everything done');
      const targetDir = join(__dirname, recordingDirectory);
      const recordingFile = join(targetDir, `${callId}.wav`);
      
      await uploadFileToServer(recordingUploadEndpoint, recordingUploadToken, {
        callId,
        fileBuffer: fs.readFileSync(recordingFile),
      });
      fs.rmSync(recordingFile, { force: true });
      delete sessions[`${sessionId}_${handleId}`];
    }
  });
}, 1000);
// const targetDir = join(__dirname, recordingDirectory);
// const recordingFile = join(targetDir, `89c3e6aa92036fc4ccf379cdf28dba77.wav`);
// uploadFileToServer(recordingUploadEndpoint, recordingUploadToken, {
//   callId: "89c3e6aa92036fc4ccf379cdf28dba77",
//   fileBuffer: fs.readFileSync(recordingFile),
// }).then((res)=>{
//   console.log('cleanup now')
// });
const processEvents = (events, state) => {
  return _.transform(
    events,
    (result, item) => {
      const { session_id, handle_id } = item;
      // console.log(item)
      if (item?.event?.plugin === "janus.plugin.sip") {
        // when call is disconnected for any reason eg nuclear attack
        if (item?.event?.name === "detached") {
          console.log("came here detached");
          if (result[`${session_id}_${handle_id}`]) {
            console.log("came here detached");
            result[`${session_id}_${handle_id}`].recordingStart = false;
            result[`${session_id}_${handle_id}`].recordingEnd = true;
          }
        }
        if (item?.event?.data) {
          const { event: eventName, "call-id": callId } = item?.event?.data;
          // when call is disconnected gracefully by hangup from either side
          if (eventName === "hangup") {
            if (result[`${session_id}_${handle_id}`]) {
              console.log("came here hangup");
              result[`${session_id}_${handle_id}`].recordingStart = false;
              result[`${session_id}_${handle_id}`].recordingEnd = true;
            }
          }
          // marks the beginning of our call when call is accepted by end user
          if (eventName === "accepted" && callId) {
            result[`${session_id}_${handle_id}`] = {
              recordingStart: true,
              recordingEnd: false,
              sessionId: session_id,
              handleId: handle_id,
              callId,
            };
          }
        }
      }
    },
    state
  );
};

router.post("/event-handler", function (req, res, next) {
  sessions = { ...sessions, ...processEvents(req.body, sessions) };
  res.json({});
});

module.exports = router;
