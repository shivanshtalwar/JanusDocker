import Aigle from "aigle";
import _ from "lodash";
import axios from "axios";
import FormData from "form-data";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { readFileSync, rmSync } from "fs";
import { Router } from "express";
import { convertMjrFilesToAudioFile } from "../converter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const router = Router();
const baseDirPath = "/recordings";
const recordingUploadEndpoint = process.env.RECORDING_UPLOAD_ENDPOINT;
const recordingUploadToken = process.env.URI_CONV_AUTH_TOKEN;
// object to store and manage all successful calls for recordings
let sessions = {};

const uploadFileToServer = async (url, token, { fileBuffer, callId }) => {
  const form = new FormData();
  // Second argument  can take Buffer or Stream (lazily read during the request) too.
  // Third argument is filename if you want to simulate a file upload. Otherwise omit.
  form.append("callId", callId);
  form.append("file", fileBuffer, `${callId}.wav`);
  const headers = {
    ...form.getHeaders(),
    authorization: `Bearer ${token}`,
  };
  console.log(headers);
  return axios.post(url, form, {
    headers,
  });
};

// a timer to process each recording and remove them from session after uploading
setInterval(async () => {
  await Aigle.eachSeries(sessions, async ({ sessionId, handleId, callId, recordingEnd }) => {
    if (recordingEnd) {
      try{
      console.log("recording ended");
      await convertMjrFilesToAudioFile(baseDirPath, join(baseDirPath, `${callId}-peer-audio.mjr`), join(baseDirPath, `${callId}-user-audio.mjr`));
      console.warn("everything done");
      const recordingFile = join(baseDirPath, `${callId}.wav`);
      console.log(recordingFile)
      await uploadFileToServer(recordingUploadEndpoint, recordingUploadToken, {
        callId,
        fileBuffer: readFileSync(recordingFile),
      });
      rmSync(recordingFile, { force: true });
      delete sessions[`${sessionId}_${handleId}`];
      }
      catch(error){
        console.error(error)
      }
    }
  });
}, 1000);

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
          const { event: eventName, "call-id": callId } = item.event.data;
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

router.get("/health", function (req, res, next) {
  res.json({ message: "converter operational" });
});
// sessions = {
//   ...sessions,
//   ...processEvents(
//     [
//       {
//         event: {
//           // name:'detached',
//           plugin: "janus.plugin.sip",
//           data: {
//             "call-id": "test",
//             event: "accepted",
//           },
//         },
//         session_id: 1,
//         handle_id: 2,
//       },
//     ],
//     sessions
//   ),
// };
// sessions = {
//   ...sessions,
//   ...processEvents(
//     [
//       {
//         event: {
//           // name:'detached',
//           plugin: "janus.plugin.sip",
//           data: {
//             "call-id": "test",
//             event: "hangup",
//           },
//         },
//         session_id: 1,
//         handle_id: 2,
//       },
//     ],
//     sessions
//   ),
// };
export default router;
