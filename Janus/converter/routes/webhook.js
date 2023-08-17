import _ from "lodash";
import axios from "axios";
import FormData from "form-data";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import path from "path";
import { rmSync } from "fs";
import storage from "node-persist";
import { Router } from "express";
import { convertMjrFilesToAudioFile } from "../converter.js";
import { Storage } from "@google-cloud/storage";
import Aigle from "aigle";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });
await storage.init();
const router = Router();
const isDev = process.env.DEV;
const baseDirPath = process.env.RECORDINGS_VOLUME ?? isDev ? path.join(__dirname, "../../recordings") : "/recordings";
const googleCloudAuthKeyFile = process.env.GCP_AUTH_KEY_FILE;
const googleCloudBucket = process.env.GCS_BUCKET;
console.log(baseDirPath);
const GoogleStorage = new Storage({
  keyFilename: googleCloudAuthKeyFile,
});

const uploadFileToGoogleBucket = async (bucketName, filePath) => {
  // Uploads a local file to the bucket
  return GoogleStorage.bucket(bucketName).upload(filePath, { private: true });
};

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
        // const fileUploaded = await uploadFileToGoogleBucket(googleCloudBucket, recordingFile);
        // console.log("file was uploaded ", fileUploaded);
        // rmSync(recordingFile, { force: true });
        delete sessions[`${sessionId}_${handleId}`];
        await setSessions(sessions);
        console.log("completed", sessionId, handleId, recordingFile);
      } catch (error) {
        console.error(error);
        sessions[`${sessionId}_${handleId}`].errorCount += 1;
        if (sessions[`${sessionId}_${handleId}`].errorCount === 3) {
          delete sessions[`${sessionId}_${handleId}`];
          await setSessions(sessions);
        }
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
              errorCount: 0,
            };
          }
        }
      }
    },
    state
  );
};

const handleEvents = async (events) => {
  const sessions = await getSessions();
  await setSessions({ ...sessions, ...processEvents(events, sessions) });
};

const callId = "28721063efe94575c8131e5f4e92a2d9";
const acceptedEvent = [
  {
    event: {
      plugin: "janus.plugin.sip",
      data: {
        event: "accepted",
        "call-id": callId,
      },
    },
    session_id: "session",
    handle_id: "handleId",
  },
];
const hangUpEvent = [
  {
    event: {
      plugin: "janus.plugin.sip",
      data: {
        event: "hangup",
        "call-id": callId,
      },
    },
    session_id: "session",
    handle_id: "handleId",
  },
];
await handleEvents(acceptedEvent);
await handleEvents(hangUpEvent);
console.log(await getSessions());
router.post("/event-handler", async function (req, res, next) {
  await handleEvents(req.body);
  res.json({});
});

router.get("/health", function (req, res, next) {
  res.json({ message: "converter operational" });
});

export default router;
