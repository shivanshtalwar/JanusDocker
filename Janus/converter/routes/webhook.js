import _ from "lodash";
import axios from "axios";
import FormData from "form-data";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createReadStream, rmSync } from "fs";
import storage from "node-persist";
import { Router } from "express";
import { convertMjrFilesToAudioFile } from "../converter.js";
import Aigle from "aigle";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });
await storage.init();
const router = Router();
const baseDirPath = process.env.RECORDINGS_VOLUME ?? "/recordings";
const recordingUploadEndpoint = process.env.RECORDING_UPLOAD_ENDPOINT;
const recordingUploadToken = process.env.URI_CONV_AUTH_TOKEN;

const getSessions = async () => {
  const value = storage.getItem("sessions");
  if (!value) {
    return {};
  }
  return value;
};
const setSessions = async (sessions) => {
  return storage.setItem("sessions", sessions);
};
// // object to store and manage all successful calls for recordings
// let sessions = {};
/**
 *
 */
const uploadFileToServer = async (url, token, { fileStream, callId }) => {
  const form = new FormData();
  form.append("callId", callId);
  form.append("file", fileStream, `${callId}.wav`);
  const headers = {
    ...form.getHeaders(),
    authorization: `Bearer ${token}`,
  };
  await Promise.all([
    new Promise((resolve, reject) => {
      fileStream.on("end", (y) => {
        resolve();
      });
      fileStream.on("error", (error) => {
        reject();
      });
    }),
    axios.post(url, form, {
      headers,
    }),
  ]);
};

const processRecordingUpload = async () => {
  const sessions = await getSessions();
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
        setSessions(sessions);
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

router.post("/event-handler", async function (req, res, next) {
  const sessions = await getSessions();
  setSessions({ ...sessions, ...processEvents(req.body, sessions) });
  res.json({});
});

router.get("/health", function (req, res, next) {
  res.json({ message: "converter operational" });
});

export default router;
