const spawn = require("child_process").spawn;
const _ = require("lodash");
const aigle = require("aigle");
const Aigle = aigle.Aigle;
const path = require("path");
const recording_directory = "../recordings";

const spawnPromise = (cmd, args) => {
  return new Promise((resolve, reject) => {
    try {
      const runCommand = spawn(cmd, args, { shell: true });
      runCommand.on("close", (code) => {
        resolve(code);
      });
      runCommand.stdout.on("data", (data) => resolve(data.toString()));
      runCommand.on("error", (err) => {
        throw new Error(err.message);
      });
    } catch (e) {
      reject(e);
    }
  });
};

const convertMjrFilesToAudioFile = async (targetDirectoryPath, ...mjrFiles) => {
  const wavFilesToProcess = {};
  let gotError = false;

  await Aigle.each(mjrFiles, async (filePath) => {
    try {
      const fileNameWithoutExtension = _.last(
        _.split(_.first(_.split(filePath, ".mjr")), "/")
      );
      const fileNameTokens = _.split(fileNameWithoutExtension, "-");
      const [callerId, owner, type] = fileNameTokens;
      if (_.size(fileNameTokens) !== 3) {
        throw "Invalid mjr file name";
      }
      const wavFilePath = path.join(
        targetDirectoryPath,
        `${fileNameWithoutExtension}.wav`
      );
      if (!wavFilesToProcess[callerId]) {
        wavFilesToProcess[callerId] = {
          callerId,
          files: [
            {
              filePath,
              wavFilePath,
              callerId,
              fileNameWithoutExtension,
              owner,
              type,
            },
          ],
        };
      } else {
        wavFilesToProcess[callerId].files.push({
          filePath,
          wavFilePath,
          callerId,
          fileNameWithoutExtension,
          owner,
          type,
        });
      }

      let result = await spawnPromise(`janus-pp-rec`, [filePath, wavFilePath]);
      console.info(result);
      result = await spawnPromise(`rm`, [`-rf ${filePath}`]);
      console.info(result);
    } catch (error) {
      console.error(error);
      gotError = true;
      return;
    }
  });
  if (!gotError) {
    try {
      await Aigle.each(wavFilesToProcess, async (wavFile) => {
        if (_.size(wavFile.files) < 2) {
          throw "Files Insufficient for conversion";
        }
        const wavFilesToken = _.join(
          _.map(wavFile.files, (wavFile) => {
            return `-i ${wavFile.wavFilePath}`;
          }),
          " "
        );
        const wavFilesRemoveToken = _.join(
          _.map(wavFile.files, (wavFile) => {
            return `${wavFile.wavFilePath}`;
          }),
          " "
        );
        const targetPath = path.join(
          targetDirectoryPath,
          wavFile.callerId + ".wav"
        );
        result = await spawnPromise("ffmpeg", [
          `-y ${wavFilesToken} -filter_complex amix=inputs=${wavFile.files.length}:duration=first:dropout_transition=${wavFile.files.length} ${targetPath}`,
        ]);
        console.info(result);
        result = await spawnPromise(`rm`, [`-rf ${wavFilesRemoveToken}`]);
        console.info(result);
      });
    } catch (error) {
      console.error(error);
    }
  }
};

const main = async () => {
  const baseDirPath = path.join(__dirname, recording_directory);
  await convertMjrFilesToAudioFile(
    baseDirPath,
    path.join(baseDirPath, "1ifAS6iMVKSwGtquGDm2Fco-peer-audio.mjr"),
    path.join(baseDirPath, "1ifAS6iMVKSwGtquGDm2Fco-user-audio.mjr")
  );
};
main();
