import Aigle from "aigle";
import _ from "lodash";
import request from "request";
import axios from "axios";
import FormData from "form-data";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createReadStream, readFileSync, rmSync } from "fs";
import { Router } from "express";
import { convertMjrFilesToAudioFile } from "../converter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const router = Router();
const baseDirPath = process.env.RECORDINGS_VOLUME ?? "/recordings";
const recordingUploadEndpoint = process.env.RECORDING_UPLOAD_ENDPOINT;
const recordingUploadToken = process.env.URI_CONV_AUTH_TOKEN;
// object to store and manage all successful calls for recordings
let sessions = {};
/**
 *
 */
const uploadFileToServer = async (url, token, { fileStream, callId }) => {
  return new Promise(async (resolve, reject) => {
    // const form = new FormData();
    // Second argument  can take Buffer or Stream (lazily read during the request) too.
    // Third argument is filename if you want to simulate a file upload. Otherwise omit.
    // form.append("callId", callId);
    // form.append("file", fileStream, `${callId}.wav`);
    const headers = {
      // ...form.getHeaders(),
      authorization: `Bearer ${token}`,
    };
    request.post(
      {
        headers,
        url,
        formData: {
          callId,
          file: {
            value: fileStream,
            options: {
              contentType: "audio/wav; charset=utf-8",
              filename: `${callId}.wav`,
            },
          },
        },
      },
      (err, res, body) => {
        if (err || res.statusCode !== 200) {
          console.log(err || "Error status code: " + res.statusCode);
          console.log(body);
          reject({ err, body });
          return;
        }
        resolve(body);
      }
    );
  });
};

const processRecordingUpload = async () => {
  await Aigle.eachSeries(sessions, async ({ sessionId, handleId, callId, recordingEnd }) => {
    if (recordingEnd) {
      try {
        await convertMjrFilesToAudioFile(baseDirPath, join(baseDirPath, `${callId}-peer-audio.mjr`), join(baseDirPath, `${callId}-user-audio.mjr`));
        const recordingFile = join(baseDirPath, `${callId}.wav`);
        console.log(`${recordingFile} created proceeding to upload`);
        await uploadFileToServer(recordingUploadEndpoint, recordingUploadToken, {
          callId,
          fileStream: createReadStream(recordingFile),
        });
        rmSync(recordingFile, { force: true });
        delete sessions[`${sessionId}_${handleId}`];
        console.log("completed", sessionId, handleId, recordingFile);
      } catch (error) {
        console.error(error);
      }
    }
  });
};

// a timer to process each recording and remove them from session after uploading
const start = () => {
  setTimeout(async () => {
    await processRecordingUpload();
    start();
  }, 1000);
};
start();

const processEvents = (events, state) => {
  return _.transform(
    events,
    (result, item) => {
      const { session_id, handle_id } = item;
      if (item?.event?.plugin === "janus.plugin.sip") {
        // when call is disconnected for any reason eg nuclear attack
        if (item?.event?.name === "detached") {
          if (result[`${session_id}_${handle_id}`]) {
            result[`${session_id}_${handle_id}`].recordingStart = false;
            result[`${session_id}_${handle_id}`].recordingEnd = true;
          }
        }
        if (item?.event?.data) {
          const { event: eventName, "call-id": callId } = item.event.data;
          // when call is disconnected gracefully by hangup from either side
          if (eventName === "hangup") {
            if (result[`${session_id}_${handle_id}`]) {
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

export default router;
